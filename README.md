# Discord bot that I use to track when my friends are playing on our Minecraft server

it does what it says it does :)

This Bot assumes that you have enabled RCON on your Minecraft server and that you've port forwarded the RCON server port.

### Setup
To start, clone this repo and run `npm install` to install all libraries and dependencies.

On your local, you will need to create a `.env` file.  
Populate it with the following fields:

```dosini
TOKEN=your-discord-bot-token
GUILD=your-discord-server-id
CHANNEL_NAME=your-player-tracking-channel
SERVER_NAME=Your Minecraft Server Name
RCON_HOST=your.minecraft.server.ip
RCON_PORT=Your minecraft server RCON port
RCON_PASSWORD=Your minecraft server RCON password
```

### Notes
Please note that your player tracking channel does not need to exist at the time that you run the bot. It will be created if it does not already exist.

Please also include a jpg file to be used for the embed message
that will be used for the player tracker.

It must be called `thumbnail.jpg` otherwise you will need to change the code.

---
Copyright (c) 2023 Ethan "steve" Bradley