# Scripts

Helper scripts for running Pavilion Hub locally without an installed MongoDB service.

- `start-mongo.ps1`: launches a local `mongod` background process using the MongoDB binary cached by `mongodb-memory-server` in `$env:USERPROFILE\.cache\mongodb-binaries\`, storing data in `.mongo-data/`.
