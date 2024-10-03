#!/bin/bash

# Infinite loop
while true
do
    # Start two "wardend start" commands in the background
    echo "Starting first wardend instance..."
    ../../build/wardend start --home ~/warden-val &
    WARDEND_PID1=$!
    echo "First wardend instance started with PID $WARDEND_PID1."
    
    echo "Starting second wardend instance..."
    ../../build/wardend start --home ~/warden-api &
    WARDEND_PID2=$!
    echo "Second wardend instance started with PID $WARDEND_PID2."

    # Run "tsx src/index.ts" command in the background
    echo "Starting tsx src/index.ts..."
    yarn start src/index.ts &
    TSX_PID=$!
    echo "tsx src/index.ts started with PID $TSX_PID."

    # Sleep for 10 seconds
    echo "Sleeping for 10 seconds..."
    sleep 10

    # Stop the "tsx src/index.ts" command
    echo "Stopping tsx src/index.ts with PID $TSX_PID..."
    kill $TSX_PID
    wait $TSX_PID 2>/dev/null
    echo "tsx src/index.ts stopped."

    # Send SIGTERM signal to the first two wardend commands
    kill -s TERM $WARDEND_PID1
    kill -s TERM $WARDEND_PID2

    # Wait for the processes to exit
    echo "Waiting for first wardend instance to terminate..."
    wait $WARDEND_PID1 2>/dev/null
    echo "First wardend instance terminated."

    echo "Waiting for second wardend instance to terminate..."
    wait $WARDEND_PID2 2>/dev/null
    echo "Second wardend instance terminated."
    # Short delay before repeating the loop

    echo "Restarting loop in 1 second..."
    sleep 1
done
