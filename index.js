const { Client, GatewayIntentBits, Guild, ChannelType, TextChannel, Message, EmbedBuilder } = require("discord.js");
const Rcon = require('rcon-client').Rcon;
const sleep = async (timeout = 5_000) => await new Promise(resolve => setTimeout(resolve, timeout));
require("dotenv").config()

const channelName = process.env.CHANNEL_NAME || "online-players";

/** @type {Map<string, number>} */
const map = new Map()

/** @type {string[]} */
const regex = /There are [0-9]{1,2} of a max of [0-9]{2} players online:/;

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

const rconConfig = {
	host: process.env.RCON_HOST,
	port: process.env.RCON_PORT,
	password: process.env.RCON_PASSWORD,
	timeout: 500
}

// RCON server requests will wait until discord connection is established
let ready = false;

/** @type {TextChannel} */
let playersChannel;

/** @type {Message} */
let playersMessage;


client.on("ready", async () => {
	console.log(`${client.user.username} is submissive and breedable!`);

	/** @type {Guild} */
	const guild = await client.guilds.fetch(process.env.GUILD);
	const channels = await guild.channels.fetch();

	playersChannel = channels.find(c => c.name.toLowerCase() === channelName);
	if (!playersChannel) { 
		// Create the players channel if it doesn't exist
		console.log("Creating channel and message for player log");
		playersChannel = await guild.channels.create({ type: ChannelType.GuildText, name: channelName })
	}

	const pinned = await playersChannel.messages.fetchPinned();
	playersMessage = pinned.find(msg => msg.author.id === client.user.id);
	if (!playersMessage) {
		playersMessage = await playersChannel.send({ embeds: [buildNewEmbed()], files: ['./thumbnail.jpg'] })
		await playersMessage.pin(); // pin the message to the channel to locate it easily
	}
	
	ready = true;
})

/**
 * 
 * @param {import("discord.js").APIEmbedField[]} fields 
 */
function buildNewEmbed(fields = []) {
	return new EmbedBuilder()
		.setDescription(`The following players are online in ${process.env.SERVER_NAME}:`)
		.setTitle(process.env.SERVER_NAME)
		.setColor("Green")
		.setThumbnail("attachment://thumbnail.jpg")
		.setFooter({ text: "This program does not work reliably :)" })
		.addFields(fields);
	
}


/**
 * TODO: Consider the following ideas:
 * - Track when people were last online
 * - Track when someone joins the server for the first time
 * - Anything else?
 * @param {Rcon} rcon 
 */
async function playerTracker(rcon) {
	while (true) {
		await sleep(300);
		// Wait for discord bot login
		if (!ready) continue;

		const listResponse = await rcon.send("list");
		if (!listResponse.match(regex)) // See regex template above
			continue;

		console.log(listResponse);

		// Break down RCON response to an Array of player usernames
		// Convert to an Array: ["player1","player2","player3"]
		const onlineList = listResponse.split(regex)
			.pop() // CSV of usernames. Example: player1, player2, player3
			.replace(/ +/, "")
			.split(",") 
			.filter(player => player.trim().length);
		
		/** @type {import("discord.js").APIEmbedField[]} */
		const fields = [];
		if (onlineList.length) { 
			// FIXME: I must be stupid because this isn't working reliably for some reason

			// Delete all players from map that have disconnected
			for (const player of map.keys()) {
				if (!onlineList.includes(player))
					map.delete(player);
			}
			
			// Add all recently connected players from the server
			for (const player of onlineList) {
				if (!map.has(player))
					map.set(player, Date.now());
			}
			
			// Generate the embed fields for the message in the player tracking channel 
			for (const [player, timestamp] of map.entries()) {
				fields.push({ name: player, value: `<t:${Math.floor(timestamp / 1000)}:R>` })
			}
		}
		
		const embed = buildNewEmbed(fields);

		playersMessage = await playersMessage.edit({ embeds: [embed], files: ['./thumbnail.jpg'] })
		await sleep(60_000);
	}
}

async function login() {
	const numMinutes = 10;
	const iterations = numMinutes * 60;
	for (let i = 0; i < iterations; i++) {
		try {
			await client.login(process.env.TOKEN);
			break;
		} catch (error) {
			console.log("Could not connect to Discord :(");
			await sleep(1_000);
		}
	}

	while (1) {
		try {
			await playerTracker(await new Rcon(rconConfig).connect());
		} catch (error) {
			console.error(error)
			console.log("Something stinky happened, reconnecting to the RCON server.");
		}
	}
}

login()
