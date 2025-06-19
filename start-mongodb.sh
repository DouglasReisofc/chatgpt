#!/bin/bash

# Create data directory if it doesn't exist
mkdir -p mongodb-data
mkdir -p mongodb-logs

# Start MongoDB
mongod --dbpath mongodb-data --logpath mongodb-logs/mongod.log --fork

echo "MongoDB started successfully!"
