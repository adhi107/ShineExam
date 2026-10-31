from pathlib import Path
import re

cahub_path = Path("frontend/src/components/CurrentAffairs/CurrentAffairsHub.tsx")
content = cahub_path.read_text(encoding="utf-8")

# 1. Add selectedDate state
old_state = '  const [search, setSearch] = useState("");'
new_state = '  const [search, setSearch] = useState("");\n  const [selectedDate, setSelectedDate] = useState<string>("");'
if old_state in content:
    content = content.replace(old_state, new_state, 1)

# 2. Update loadArticles
old_load_regex = re.compile(
    r'const loadArticles = useCallback\(async \(\) => \{\s*\n'
    r'\s*setLoading\(true\);\s*\n'
    r'\s*try \{\s*\n'
    r'\s*const params = new URLSearchParams\(\);\s*\n'
    r'\s*if \(selectedCategory !== "All"\) params\.set\("category", selectedCategory\);\s*\n'
    r'\s*if \(search\) params\.set\("search", search\);\s*\n'
    r'\s*const res = await apiGet<\{ articles: CurrentAffairItem\[\]; categories: string\[\] \}>\(\s*\n'
    r'\s*`/admin/current-affairs/articles\?\$\{params\}`\s*\n'
    r'\s*\);\s*\n'
    r'\s*setArticles\(res\.articles \|\| \[\]\);\s*\n'
    r'\s*if \(res\.categories && res\.categories\.length\) \{\s*\n'
    r'\s*setCategories\(\["All", \.\.\.res\.categories\]\);\s*\n'
    r'\s*\}\s*\n'
    r'\s*\} catch \{\s*\n'
    r'\s*setArticles\(\[\]\);\s*\n'
    r'\s*\} finally \{\s*\n'
    r'\s*setLoading\(false\);\s*\n'
    r'\s*\}\s*\n'
    r'\s*\}, \[selectedCategory, search\]\);',
    re.DOTALL
)

new_load = '''const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      if (search) params.set("search", search);
      if (selectedDate) params.set("date", selectedDate);
      if (!isAdmin) params.set("status", "published");
      const res = await apiGet<{ articles: CurrentAffairItem[]; categories: string[] }>(
        `/admin/current-affairs/articles?${params}`
      );
      setArticles(res.articles || []);
      if (res.categories && res.categories.length) {
        setCategories(["All", ...res.categories]);
      }
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search, selectedDate, isAdmin]);'''

if old_load_regex.search(content):
    content = old_load_regex.sub(new_load, content, count=1)

# 3. Add date filter input to ca-search-box
old_search_box_regex = re.compile(
    r'<div className="ca-search-box">\s*\n'
    r'\s*<input\s*\n'
    r'\s*className="ca-search-input"\s*\n'
    r'\s*placeholder="Search current affairs, schemes, committee reports\.\.\."\s*\n'
    r'\s*value=\{search\}\s*\n'
    r'\s*onChange=\{\(e\) => setSearch\(e\.target\.value\)\}\s*\n'
    r'\s*/>\s*\n'
    r'\s*</div>',
    re.DOTALL
)

new_search_box = '''<div className="ca-search-box" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="ca-search-input"
            style={{ flex: "1 1 240px", minWidth: 200 }}
            placeholder="Search current affairs, schemes, committee reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="Filter by publish date"
              style={{
                height: 38,
                padding: "0 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                fontSize: "0.85rem",
                background: "#ffffff",
                color: "#1e293b",
              }}
            />
            {selectedDate && (
              <button
                className="ats-btn ats-btn-secondary ats-btn-sm"
                onClick={() => setSelectedDate("")}
                title="Clear date filter"
                style={{ height: 38, padding: "0 10px", fontSize: "0.8rem" }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>'''

if old_search_box_regex.search(content):
    content = old_search_box_regex.sub(new_search_box, content, count=1)

cahub_path.write_text(content, encoding="utf-8")
print("SUCCESS: CurrentAffairsHub.tsx updated with date filtering!")

