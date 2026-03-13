"""
Test Anthropic Computer Use detection signals.

Sends a Computer Use request to open Firefox inside the Docker container,
navigate to our detection probe page, and screenshot the results.
"""

import os
import json
import base64
import urllib.request
import sys

API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
if not API_KEY:
    print("ERROR: ANTHROPIC_API_KEY not set")
    sys.exit(1)

PROBE_URL = "http://host.docker.internal:9999/detection-probe.html"

def call_computer_use(messages, tools):
    """Make a Computer Use API call."""
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=json.dumps({
            'model': 'claude-sonnet-4-5-20250929',
            'max_tokens': 4096,
            'anthropic_beta': ['computer-use-2025-01-24'],
            'tools': tools,
            'messages': messages,
        }).encode(),
        headers={
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'computer-use-2025-01-24',
            'content-type': 'application/json',
        }
    )
    resp = urllib.request.urlopen(req, timeout=60)
    return json.loads(resp.read())

# Define the computer tool
tools = [
    {
        "type": "computer_20250124",
        "name": "computer",
        "display_width_px": 1024,
        "display_height_px": 768,
        "display_number": 1,
    }
]

# Step 1: Ask Claude to open Firefox and navigate to probe page
print("Step 1: Asking Computer Use to open Firefox and navigate to probe page...")
messages = [
    {
        "role": "user",
        "content": f"Open Firefox and navigate to {PROBE_URL}. Wait for the page to fully load, then take a screenshot so I can see the detection probe results."
    }
]

try:
    response = call_computer_use(messages, tools)
    print(f"Response stop_reason: {response.get('stop_reason')}")

    # Process response - look for tool_use blocks and text
    for block in response.get('content', []):
        if block['type'] == 'text':
            print(f"Claude says: {block['text']}")
        elif block['type'] == 'tool_use':
            print(f"Tool call: {block['name']} - {json.dumps(block.get('input', {}))[:200]}")

    # If Claude wants to use tools, we need to execute them via the container
    # For this test, we'll just run the browser command directly in the container
    print("\nDirect approach: Running Firefox in container and capturing detection results...")

except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"API Error HTTP {e.code}: {body[:500]}")

    # If Computer Use API isn't available, fall back to direct container approach
    print("\nFalling back to direct container execution...")

# Direct approach: use the container's browser to load the probe page
# and extract the detection results via JavaScript
import subprocess

print("\n--- Direct Container Detection Test ---")
print("Installing chromium in container and running detection probe...")

# The container has Firefox. Let's use it directly with xdotool
# First, check what's available
result = subprocess.run(
    ['docker', 'exec', 'computer-use-test', 'which', 'firefox'],
    capture_output=True, text=True
)
print(f"Firefox path: {result.stdout.strip()}")

# Use the container's Python to run a headless browser test
# The container should have Python available
detect_script = '''
import subprocess
import json
import time

# Start Firefox in the background pointing to the probe page
subprocess.Popen(
    ['firefox', '--headless', '--screenshot', '/tmp/probe-screenshot.png',
     'http://host.docker.internal:9999/detection-probe.html'],
    env={**__import__('os').environ, 'DISPLAY': ':1'},
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(5)

# The HTML page runs JS that fills in results - but in headless screenshot mode
# we can't easily extract the text. Let's use a different approach:
# Use curl to get the page, then note that the JS results are client-side only.
#
# Better approach: use the xdotool environment to detect signals from INSIDE
# the container, mimicking what Computer Use would see.

import platform
results = {}
results['platform'] = platform.system()
results['machine'] = platform.machine()

# Check screen resolution (Xvfb)
try:
    out = subprocess.check_output(['xdpyinfo', '-display', ':1'], text=True, stderr=subprocess.DEVNULL)
    for line in out.split('\\n'):
        if 'dimensions:' in line:
            results['xvfb_dimensions'] = line.strip()
except Exception as e:
    results['xvfb_dimensions'] = f'error: {e}'

# Check if xdotool is available (Computer Use uses this)
try:
    out = subprocess.check_output(['xdotool', 'version'], text=True, stderr=subprocess.DEVNULL)
    results['xdotool'] = out.strip()
except:
    results['xdotool'] = 'not found'

# Check WebGL renderer by running a quick browser check
# The key signal is whether the GPU renders with software (llvmpipe)
try:
    out = subprocess.check_output(
        ['glxinfo', '-display', ':1'], text=True, stderr=subprocess.DEVNULL
    )
    for line in out.split('\\n'):
        if 'OpenGL renderer' in line:
            results['gl_renderer'] = line.strip()
        if 'OpenGL vendor' in line:
            results['gl_vendor'] = line.strip()
except Exception as e:
    results['gl_renderer'] = f'error: {e}'

print(json.dumps(results, indent=2))
'''

result = subprocess.run(
    ['docker', 'exec', 'computer-use-test', 'python3', '-c', detect_script],
    capture_output=True, text=True, timeout=30
)
print("Container environment signals:")
print(result.stdout)
if result.stderr:
    print(f"stderr: {result.stderr[:300]}")
