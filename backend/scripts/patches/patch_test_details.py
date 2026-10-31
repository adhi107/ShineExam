with open('frontend/src/components/TestInterface.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_needle = '<TestDetails\n          testName={testName}\n          duration={duration}\n          questionCount={questions.length}\n          passingPercentage={passingPercentage}\n          onContinue={() => setTestStep("instructions")}\n        />'
old_needle_crlf = old_needle.replace('\n', '\r\n')

new_replacement = '<TestDetails\n          testName={testName}\n          duration={duration}\n          questionCount={questions.length}\n          passingPercentage={passingPercentage}\n          userName={userId}\n          onContinue={() => setTestStep("instructions")}\n          onBack={onExit}\n        />'

if old_needle in text:
    text = text.replace(old_needle, new_replacement, 1)
    with open('frontend/src/components/TestInterface.tsx', 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print("Replaced LF successfully")
elif old_needle_crlf in text:
    new_replacement_crlf = new_replacement.replace('\n', '\r\n')
    text = text.replace(old_needle_crlf, new_replacement_crlf, 1)
    with open('frontend/src/components/TestInterface.tsx', 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print("Replaced CRLF successfully")
else:
    print("Could not find needle in file!")

