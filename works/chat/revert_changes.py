import subprocess

try:
    print("Running git checkout...")
    res = subprocess.run(["git", "checkout", "--", "chat/premium-chat-theme.css", "chat/www/premium-chat-theme.css", "chat/index.html", "chat/www/index.html"], 
                         capture_output=True, text=True, check=True)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
    print("Reverted successfully!")
except Exception as e:
    print("Error:", e)
