import os
import shutil
import struct
import subprocess
import tempfile


def optimize_mp4_faststart(input_path: str) -> bool:
    """Optimizes an MP4/M4V/MOV file by moving the 'moov' atom before the 'mdat' atom.
    
    This enables instant video playback (FastStart) in web browsers without downloading
    the full file or waiting for byte ranges from the end of the file.
    
    Tries ffmpeg with '-c copy -movflags +faststart' first.
    If ffmpeg is not available, uses a native pure-Python atom parser and relocator.
    """
    if not os.path.exists(input_path):
        return False

    ext = input_path.rsplit(".", 1)[-1].lower() if "." in input_path else ""
    if ext not in ("mp4", "m4v", "mov", "m4a"):
        return False

    # 1. Try ffmpeg faststart (zero re-encoding, extremely fast ~0.1s)
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=f".{ext}")
        os.close(tmp_fd)
        
        # Run ffmpeg with high-speed stream copy
        res = subprocess.run(
            ["ffmpeg", "-y", "-i", input_path, "-c", "copy", "-movflags", "+faststart", tmp_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30
        )
        if res.returncode == 0 and os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0:
            shutil.move(tmp_path, input_path)
            return True
        else:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception:
        pass

    # 2. Pure Python native MP4 faststart repositioner (Zero external dependencies)
    try:
        return _pure_python_faststart(input_path)
    except Exception:
        return False


def _pure_python_faststart(filepath: str) -> bool:
    """Pure Python implementation to relocate the 'moov' atom before 'mdat' in MP4/MOV files."""
    file_size = os.path.getsize(filepath)
    if file_size < 32:
        return False

    atoms = []
    with open(filepath, "rb") as f:
        offset = 0
        while offset < file_size:
            f.seek(offset)
            header = f.read(8)
            if len(header) < 8:
                break
            size, atom_type = struct.unpack(">I4s", header)
            atom_name = atom_type.decode("latin1", errors="ignore")

            atom_header_size = 8
            if size == 1:  # 64-bit large size
                ext_header = f.read(8)
                if len(ext_header) < 8:
                    break
                size = struct.unpack(">Q", ext_header)[0]
                atom_header_size = 16
            elif size == 0:  # Extends to EOF
                size = file_size - offset

            atoms.append({
                "name": atom_name,
                "offset": offset,
                "size": size,
                "header_size": atom_header_size
            })

            if size <= 0:
                break
            offset += size

    moov_atom = next((a for a in atoms if a["name"] == "moov"), None)
    mdat_atom = next((a for a in atoms if a["name"] == "mdat"), None)

    # If moov already comes before mdat, it is already optimized!
    if not moov_atom or not mdat_atom:
        return False
    if moov_atom["offset"] < mdat_atom["offset"]:
        return True  # Already FastStart!

    # Need to relocate moov before mdat and adjust chunk offsets (stco / co64)
    moov_size = moov_atom["size"]
    moov_offset = moov_atom["offset"]

    with open(filepath, "rb") as f:
        f.seek(moov_offset)
        moov_data = bytearray(f.read(moov_size))

    # Update chunk offset tables inside moov data by adding moov_size shift
    _shift_chunk_offsets(moov_data, moov_size)

    # Write out the new optimized MP4
    tmp_path = filepath + ".faststart.tmp"
    with open(filepath, "rb") as src, open(tmp_path, "wb") as dst:
        # Write atoms before mdat (e.g. ftyp)
        for a in atoms:
            if a["offset"] < mdat_atom["offset"] and a["name"] != "moov":
                src.seek(a["offset"])
                shutil.copyfileobj(_LimitedReader(src, a["size"]), dst, length=1024 * 1024)

        # Write adjusted moov atom
        dst.write(moov_data)

        # Write mdat atom and any following atoms (except moov which was already written)
        for a in atoms:
            if a["offset"] >= mdat_atom["offset"] and a["name"] != "moov":
                src.seek(a["offset"])
                shutil.copyfileobj(_LimitedReader(src, a["size"]), dst, length=1024 * 1024)

    if os.path.exists(tmp_path) and os.path.getsize(tmp_path) == file_size:
        shutil.move(tmp_path, filepath)
        return True
    else:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return False


def _shift_chunk_offsets(moov_data: bytearray, shift: int):
    """Parses atom tree in moov bytearray and shifts stco/co64 chunk offsets by `shift` bytes."""
    idx = 0
    moov_len = len(moov_data)
    while idx + 8 <= moov_len:
        # Search for 'stco' (32-bit chunk offset atom)
        if moov_data[idx + 4:idx + 8] == b"stco":
            atom_size = struct.unpack(">I", moov_data[idx:idx + 4])[0]
            # stco layout: size(4) + 'stco'(4) + version_flags(4) + entry_count(4) + entries(entry_count * 4)
            if idx + 16 <= moov_len:
                entry_count = struct.unpack(">I", moov_data[idx + 12:idx + 16])[0]
                offset_pos = idx + 16
                for _ in range(entry_count):
                    if offset_pos + 4 > moov_len:
                        break
                    cur_offset = struct.unpack(">I", moov_data[offset_pos:offset_pos + 4])[0]
                    moov_data[offset_pos:offset_pos + 4] = struct.pack(">I", cur_offset + shift)
                    offset_pos += 4
            idx += max(atom_size, 8)
        # Search for 'co64' (64-bit chunk offset atom)
        elif moov_data[idx + 4:idx + 8] == b"co64":
            atom_size = struct.unpack(">I", moov_data[idx:idx + 4])[0]
            if idx + 16 <= moov_len:
                entry_count = struct.unpack(">I", moov_data[idx + 12:idx + 16])[0]
                offset_pos = idx + 16
                for _ in range(entry_count):
                    if offset_pos + 8 > moov_len:
                        break
                    cur_offset = struct.unpack(">Q", moov_data[offset_pos:offset_pos + 8])[0]
                    moov_data[offset_pos:offset_pos + 8] = struct.pack(">Q", cur_offset + shift)
                    offset_pos += 8
            idx += max(atom_size, 8)
        else:
            idx += 1


class _LimitedReader:
    def __init__(self, f, limit):
        self.f = f
        self.limit = limit
        self.copied = 0

    def read(self, size=-1):
        if self.copied >= self.limit:
            return b""
        if size < 0:
            to_read = self.limit - self.copied
        else:
            to_read = min(size, self.limit - self.copied)
        data = self.f.read(to_read)
        self.copied += len(data)
        return data
