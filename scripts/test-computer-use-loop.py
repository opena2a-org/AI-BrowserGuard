"""
Anthropic Computer Use agentic loop.

Executes tool actions inside the Docker container and sends screenshots back.
Goal: navigate to detection probe page and capture browser-side signals.
"""

import os
import json
import base64
import urllib.request
import subprocess
import sys
import time

API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
if not API_KEY:
    print("ERROR: ANTHROPIC_API_KEY not set")
    sys.exit(1)

CONTAINER = 'computer-use-test'
PROBE_URL = 'http://host.docker.internal:9999/detection-probe.html'
MAX_TURNS = 15

def api_call(messages, tools):
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=json.dumps({
            'model': 'claude-sonnet-4-5-20250929',
            'max_tokens': 4096,
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


def execute_tool(action_input):
    """Execute a Computer Use tool action in the Docker container."""
    action = action_input.get('action')

    if action == 'screenshot':
        # Take screenshot using scrot (same as Computer Use reference impl)
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'scrot', '/tmp/screenshot.png', '-o'],
            capture_output=True, timeout=10
        )
        # Read and encode the screenshot
        result = subprocess.run(
            ['docker', 'exec', CONTAINER, 'base64', '-w', '0', '/tmp/screenshot.png'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout:
            return {
                'type': 'tool_result',
                'content': [{
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': 'image/png',
                        'data': result.stdout.strip(),
                    }
                }]
            }
        return {'type': 'tool_result', 'content': 'Screenshot failed'}

    elif action == 'mouse_move':
        x, y = action_input['coordinate']
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'xdotool', 'mousemove', '--sync', str(x), str(y)],
            capture_output=True, timeout=10
        )
        return {'type': 'tool_result', 'content': f'Moved mouse to ({x}, {y})'}

    elif action == 'left_click':
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'xdotool', 'click', '1'],
            capture_output=True, timeout=10
        )
        return {'type': 'tool_result', 'content': 'Left clicked'}

    elif action == 'type':
        text = action_input.get('text', '')
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'xdotool', 'type', '--delay', '50', '--', text],
            capture_output=True, timeout=30
        )
        return {'type': 'tool_result', 'content': f'Typed: {text[:50]}'}

    elif action == 'key':
        key = action_input.get('text', '')
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'xdotool', 'key', '--', key],
            capture_output=True, timeout=10
        )
        return {'type': 'tool_result', 'content': f'Pressed key: {key}'}

    elif action == 'left_click_drag':
        sx, sy = action_input.get('start_coordinate', [0, 0])
        ex, ey = action_input.get('coordinate', [0, 0])
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'xdotool', 'mousemove', '--sync', str(sx), str(sy),
             'mousedown', '1', 'mousemove', '--sync', str(ex), str(ey),
             'mouseup', '1'],
            capture_output=True, timeout=10
        )
        return {'type': 'tool_result', 'content': f'Dragged from ({sx},{sy}) to ({ex},{ey})'}

    elif action == 'double_click':
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'xdotool', 'click', '--repeat', '2', '1'],
            capture_output=True, timeout=10
        )
        return {'type': 'tool_result', 'content': 'Double clicked'}

    elif action == 'scroll':
        x, y = action_input.get('coordinate', [512, 384])
        direction = action_input.get('direction', 'down')
        amount = action_input.get('amount', 3)
        button = '5' if direction == 'down' else '4'
        subprocess.run(
            ['docker', 'exec', '-e', 'DISPLAY=:1', CONTAINER,
             'xdotool', 'mousemove', '--sync', str(x), str(y),
             'click', '--repeat', str(amount), button],
            capture_output=True, timeout=10
        )
        return {'type': 'tool_result', 'content': f'Scrolled {direction} {amount} at ({x},{y})'}

    else:
        return {'type': 'tool_result', 'content': f'Unknown action: {action}'}


def save_screenshot(b64_data, filename):
    """Save a base64 screenshot to disk."""
    with open(filename, 'wb') as f:
        f.write(base64.b64decode(b64_data))


# --- Main loop ---

tools = [{
    'type': 'computer_20250124',
    'name': 'computer',
    'display_width_px': 1024,
    'display_height_px': 768,
    'display_number': 1,
}]

messages = [{
    'role': 'user',
    'content': (
        f'Open Firefox and navigate to {PROBE_URL}. '
        'Wait for the page to fully load. The page will display JSON detection results. '
        'Once you can see the JSON results on the page, take a final screenshot.'
    ),
}]

screenshot_count = 0

for turn in range(MAX_TURNS):
    print(f"\n=== Turn {turn + 1} ===")
    response = api_call(messages, tools)
    stop_reason = response.get('stop_reason')
    print(f"stop_reason: {stop_reason}")

    # Collect assistant content
    assistant_content = response.get('content', [])
    messages.append({'role': 'assistant', 'content': assistant_content})

    # Process each block
    tool_results = []
    for block in assistant_content:
        if block['type'] == 'text':
            print(f"  Claude: {block['text'][:200]}")
        elif block['type'] == 'tool_use':
            tool_id = block['id']
            tool_input = block.get('input', {})
            action = tool_input.get('action', 'unknown')
            print(f"  Action: {action} {json.dumps({k:v for k,v in tool_input.items() if k != 'action'})[:100]}")

            result = execute_tool(tool_input)

            # Save screenshots
            if action == 'screenshot' and isinstance(result.get('content'), list):
                for item in result['content']:
                    if item.get('type') == 'image':
                        screenshot_count += 1
                        fname = f'/tmp/cu-screenshot-{screenshot_count}.png'
                        save_screenshot(item['source']['data'], fname)
                        print(f"  Saved: {fname}")

            tool_results.append({
                'type': 'tool_result',
                'tool_use_id': tool_id,
                **result,
            })

    if stop_reason == 'end_turn':
        print("\nClaude finished.")
        break

    if not tool_results:
        print("\nNo tool calls, stopping.")
        break

    # Send tool results back
    messages.append({'role': 'user', 'content': tool_results})

print(f"\nTotal screenshots: {screenshot_count}")
if screenshot_count > 0:
    print(f"Last screenshot: /tmp/cu-screenshot-{screenshot_count}.png")
