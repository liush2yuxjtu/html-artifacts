# Runtime surfaces

## Browser/UI

Start the real app, wait for readiness, drive the user flow with available browser/UI automation, and capture the state that proves the changed behavior executed.

## CLI

Invoke the shipped/public CLI entrypoint rather than importing its internal function. Capture command, output, and exit status. For interactive CLIs, use a real PTY/tmux session.

## Server/API

Launch the server, wait for a real readiness condition, send the request a real client would send, and capture status, response, and relevant server output.

## Library

Use the package's exported public API from a separate consumer process. Avoid source-internal imports.

## Agent

Run the agent with input that reaches the changed configuration. Capture observable response/tool behavior.
