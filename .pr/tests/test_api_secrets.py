#!/usr/bin/env python3
"""
End-to-end test for per-conversation secrets passed at conversation START time.

This script tests the new `secrets` field in AppConversationStartRequest (PR #14009).
Unlike injecting secrets after conversation start, this passes them when creating
the conversation via POST /v1/app-conversations.

Usage:
    export OH_API_KEY="sk-oh-..."
    export OH_API_URL="https://ohpr-14009-xxx.staging.all-hands.dev/api"  # staging URL
    python test_api_secrets.py
"""

import os
import sys
import time
import requests
from typing import Any

# Configuration
API_KEY = os.environ.get('OH_API_KEY', '')
APP_URL = os.environ.get('OH_API_URL', 'https://app.all-hands.dev/api')

# Test secret
SECRET_NAME = "TEST_API_SECRET"
SECRET_VALUE = "FUZZY_WUZZY_WAS_A_BEAR_FUZZY_WUZZY_HAD_NO_HAIR"


def log(msg: str) -> None:
    """Print with timestamp."""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def start_sandbox() -> dict[str, Any]:
    """Start a new sandbox and wait for it to be ready."""
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    
    log("Starting sandbox...")
    resp = requests.post(f"{APP_URL}/v1/sandboxes", headers=headers, timeout=60)
    resp.raise_for_status()
    sandbox = resp.json()
    sandbox_id = sandbox["id"]
    log(f"  Sandbox ID: {sandbox_id}")
    
    # Wait for running
    log("Waiting for sandbox to be ready...")
    for i in range(120):
        resp = requests.get(
            f"{APP_URL}/v1/sandboxes",
            headers=headers,
            params={"id": sandbox_id},
            timeout=30
        )
        sandboxes = resp.json()
        if sandboxes and sandboxes[0]["status"] == "RUNNING":
            sandbox = sandboxes[0]
            session_key = sandbox["session_api_key"]
            agent_url = None
            for url_info in sandbox.get("exposed_urls", []):
                if url_info["name"] == "AGENT_SERVER":
                    agent_url = url_info["url"]
                    break
            if agent_url:
                log(f"  Agent Server: {agent_url}")
                return {
                    "sandbox_id": sandbox_id,
                    "session_api_key": session_key,
                    "agent_server_url": agent_url,
                    "headers": headers
                }
        time.sleep(2)
    
    raise TimeoutError("Sandbox did not become ready in time")


def start_conversation_with_secrets(sandbox_info: dict[str, Any]) -> str:
    """
    Start a conversation WITH secrets passed at start time.
    This tests the new `secrets` field in AppConversationStartRequest.
    """
    agent_url = sandbox_info["agent_server_url"]
    agent_headers = {"X-Session-API-Key": sandbox_info["session_api_key"]}
    
    # Get baseline conversations
    resp = requests.get(
        f"{agent_url}/api/conversations/search",
        headers=agent_headers,
        timeout=30
    )
    before_ids = set(c["id"] for c in resp.json().get("items", []))
    
    # Start conversation via app-server WITH SECRETS
    log("Starting conversation with secrets field...")
    log(f"  Secret: {SECRET_NAME}='{SECRET_VALUE[:20]}...'")
    
    request_body = {
        "sandbox_id": sandbox_info["sandbox_id"],
        "initial_message": {
            "role": "user",
            "content": [{"type": "text", "text": "Say 'Ready' and nothing else."}]
        },
        # THIS IS THE NEW FIELD BEING TESTED
        "secrets": {
            SECRET_NAME: SECRET_VALUE
        }
    }
    
    log(f"  Request body: {request_body}")
    
    resp = requests.post(
        f"{APP_URL}/v1/app-conversations",
        headers=sandbox_info["headers"],
        json=request_body,
        timeout=60
    )
    
    log(f"  Response status: {resp.status_code}")
    if resp.status_code != 200:
        log(f"  Response body: {resp.text}")
        resp.raise_for_status()
    
    response_data = resp.json()
    log(f"  Response: {response_data}")
    
    # Find new conversation on agent-server
    for i in range(30):
        resp = requests.get(
            f"{agent_url}/api/conversations/search",
            headers=agent_headers,
            timeout=30
        )
        after_ids = set(c["id"] for c in resp.json().get("items", []))
        new_ids = after_ids - before_ids
        if new_ids:
            conv_id = list(new_ids)[0]
            log(f"  Conversation ID: {conv_id}")
            return conv_id
        time.sleep(1)
    
    raise TimeoutError("Conversation did not appear on agent server")


def send_message(sandbox_info: dict[str, Any], conv_id: str, message: str) -> bool:
    """Send a message to the conversation."""
    agent_url = sandbox_info["agent_server_url"]
    agent_headers = {"X-Session-API-Key": sandbox_info["session_api_key"]}
    
    log(f"Sending message: {message[:60]}...")
    resp = requests.post(
        f"{agent_url}/api/conversations/{conv_id}/events",
        headers=agent_headers,
        json={
            "role": "user",
            "content": [{"type": "text", "text": message}],
            "run": True
        },
        timeout=60
    )
    return resp.status_code == 200


def check_events_for_secret(sandbox_info: dict[str, Any], conv_id: str) -> bool:
    """Check conversation events for evidence of the secret being used."""
    agent_url = sandbox_info["agent_server_url"]
    agent_headers = {"X-Session-API-Key": sandbox_info["session_api_key"]}
    
    log("Checking events for transformed secret...")
    resp = requests.get(
        f"{agent_url}/api/conversations/{conv_id}/events/search",
        headers=agent_headers,
        params={"limit": 100},
        timeout=60
    )
    
    if resp.status_code != 200:
        log(f"  ERROR: Could not fetch events: {resp.status_code}")
        return False
    
    events = resp.json().get("items", [])
    log(f"  Total events: {len(events)}")
    
    # Look for the transformed secret in command outputs
    for event in events:
        obs = event.get("observation", {})
        if isinstance(obs, dict):
            content = obs.get("content", "")
            # Handle both string and list content
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        text = item.get("text", "")
                        if "fuzzy" in text.lower():
                            log(f"  Found secret in output!")
                            return True
            elif isinstance(content, str) and "fuzzy" in content.lower():
                log(f"  Found secret in output!")
                return True
    
    return False


def cleanup(sandbox_info: dict[str, Any]) -> None:
    """Clean up the sandbox."""
    log("Cleaning up sandbox...")
    try:
        requests.delete(
            f"{APP_URL}/v1/sandboxes/{sandbox_info['sandbox_id']}",
            headers=sandbox_info["headers"],
            timeout=30
        )
        log("  Done.")
    except Exception as e:
        log(f"  Warning: Cleanup failed: {e}")


def main() -> int:
    print("=" * 70)
    print(" PER-CONVERSATION SECRETS AT START TIME TEST")
    print(" Testing PR #14009: secrets field in AppConversationStartRequest")
    print("=" * 70)
    print()
    
    if not API_KEY:
        print("ERROR: OH_API_KEY environment variable not set")
        print("Usage: export OH_API_KEY='sk-oh-...' && python test_api_secrets.py")
        return 1
    
    log(f"Using API URL: {APP_URL}")
    
    sandbox_info = None
    try:
        # Step 1: Start sandbox
        sandbox_info = start_sandbox()
        
        # Step 2: Start conversation WITH SECRETS (the feature being tested!)
        conv_id = start_conversation_with_secrets(sandbox_info)
        
        # Step 3: Wait for initial message to complete
        log("Waiting for initial message to complete...")
        time.sleep(15)
        
        # Step 4: Send message that uses the secret
        message = f"Run this exact command: echo ${SECRET_NAME} | tr '[:upper:]' '[:lower:]'"
        if not send_message(sandbox_info, conv_id, message):
            log("ERROR: Failed to send message")
            return 1
        
        # Step 5: Wait for agent to process
        log("Waiting for agent to execute command...")
        time.sleep(45)
        
        # Step 6: Check results
        if check_events_for_secret(sandbox_info, conv_id):
            print()
            print("=" * 70)
            print(" ✅ SUCCESS! Secrets passed at conversation start time work!")
            print(f"    Secret: {SECRET_NAME}={SECRET_VALUE}")
            print("    The secret was passed via the new 'secrets' field in")
            print("    AppConversationStartRequest and was available as an")
            print("    environment variable to the agent.")
            print("=" * 70)
            return 0
        else:
            print()
            print("=" * 70)
            print(" ⚠️  Could not verify secret in output")
            print("    The conversation started, but we couldn't find")
            print("    evidence of the secret being used in command output.")
            print("=" * 70)
            return 1
    
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    finally:
        if sandbox_info:
            cleanup(sandbox_info)


if __name__ == "__main__":
    sys.exit(main())
