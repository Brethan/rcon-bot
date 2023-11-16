//@ts-check

const { Client, GatewayIntentBits, Guild, ChannelType, TextChannel, Message, EmbedBuilder, SlashCommandBuilder, REST, Routes, SlashCommandSubcommandBuilder, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandBooleanOption, InteractionType, ChatInputCommandInteraction, AutocompleteInteraction } = require("discord.js");
const Rcon = require('rcon-client').Rcon;
const { writeFile } = require("fs/promises");
const sleep = async (timeout = 5_000) => await new Promise(resolve => setTimeout(resolve, timeout));
require("dotenv").config()

const channelName = process.env.CHANNEL_NAME || "online-players";

/** @type {Map<string, number>} */
const map = new Map()

/** @type {RegExp} */
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

let locations = require("./locations.json");
const { readFileSync } = require("fs");
const { resolve } = require("path");

/** @type {Rcon} */
let rcon;

// RCON server requests will wait until discord connection is established
let ready = false;

/** @type {TextChannel} */
let playersChannel;

/** @type {Message} */
let playersMessage;


client.on("ready", async () => {
	console.log(`${client.user?.username} is submissive and breedable!`);

	/** @type {Guild} */
	const guild = await client.guilds.fetch(process.env.GUILD || "");
	const channels = await guild.channels.fetch();

	//@ts-ignore
	playersChannel = channels.find(c => c?.name.toLowerCase() === channelName);
	if (!playersChannel) { 
		// Create the players channel if it doesn't exist
		console.log("Creating channel and message for player log");
		playersChannel = await guild.channels.create({ type: ChannelType.GuildText, name: channelName })
	}

	const pinned = await playersChannel.messages.fetchPinned();
	//@ts-ignore
	playersMessage = pinned.find(msg => msg.author.id === client.user?.id);
	if (!playersMessage) {
		playersMessage = await playersChannel.send({ embeds: [buildNewEmbed()], files: ['./thumbnail.jpg'] })
		await playersMessage.pin(); // pin the message to the channel to locate it easily
	}
	// const rest = new REST().setToken(process.env.TOKEN || "");
	// rest.put(Routes.applicationGuildCommands(client.user?.id || "", process.env.GUILD || ""), { body: [commandThing()] })
	// 	.then(() => console.log(`Registered application commands`))
	// 	.catch(console.error);

	ready = true;
})

/**
 *
 * @param {Object} details
 * @param {string} details.name
 * @param {string} details.description
 * @param {boolean} details.auto
 * @param {boolean} details.required
 * @returns
 */
function createCmdStringOption(details) {
	return new SlashCommandStringOption()
		.setName(details.name)
		.setDescription(details.description || details.name)
		.setAutocomplete(details.auto)
		.setRequired(details.required);
}

/**
 * 
 * @param {string} axis 
 */
function createCoordinateOption(axis) {
	return new SlashCommandIntegerOption()
		.setName(`${axis}`)
		.setDescription(`Coordinate for the ${axis} axis`)
		.setRequired(true);
}

function commandThing(params) {

	const addOption = createCmdStringOption({
		name: "location",
		description: "Name of the location you'd like to add",
		auto: false,
		required: true
	});

	const xOption = createCoordinateOption("x")
	const yOption = createCoordinateOption("y")
	const zOption = createCoordinateOption("z")

	const removeOption = createCmdStringOption({
		name: "location",
		description: "Name of the location to remove from the list",
		auto: true,
		required: true
	});

	const showOption = createCmdStringOption({
		name: "location",
		description: "Name of the location to show",
		auto: true,
		required: true
	});

	const serverOption = new SlashCommandBooleanOption()
		.setName("minecraft")
		.setDescription("Whether or not to send to the minecraft server")
		.setRequired(false)

	const command = new SlashCommandBuilder()
		.setName("location")
		.setDescription("Some location commands")
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName("add")
				.setDescription("Saves a location's coordinates for easy access!")
				.addStringOption(addOption)
				.addStringOption(option =>
					option.setName("dimension")
						.setDescription("The dimension where the POI is located in")
						.setRequired(true)
						.addChoices(
							{name: "Overworld", value: "overworld"},
							{name: "Nether", value: "nether"},
							{name: "End", value: "end"},
						)
				)
				.addIntegerOption(xOption)
				.addIntegerOption(yOption)
				.addIntegerOption(zOption)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName("list")
				.setDescription("Lists out all of the saved locations and their coordinates!")
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName("remove")
				.setDescription("Removes a saved location from the list")
				.addStringOption(removeOption)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName("show")
				.setDescription("Show a location in the discord and/or minecraft server")
				.addStringOption(showOption)
				.addBooleanOption(serverOption)
		)
		
	return command
}


/**
 * @typedef Coordinates
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef Location
 * @property {Coordinates} coords
 * @property {"overworld" | "nether" | "end"} dimension
 */

/**
 * 
 * @param {string} location 
 * @returns {Location}
 */
function getLocation(location) {
	return locations[location];
	
}

function getLocationNames() {
	return Object.keys(locations);
}

function getLocationsEmbed() {

}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function list(interaction) {
	let locationField = "";
	let dimensionField = "";
	let coordinateField = "";

	for (const name of getLocationNames()) {
		const location = getLocation(name);
		const { x, y, z } = location.coords;
		locationField += name + "\n";
		dimensionField += location.dimension + "\n";
		coordinateField += `\`x:${x}, y:${y}, z:${z}\`\n`;
	}

	const embed = new EmbedBuilder()
		.addFields(
			{ name: "Location Name", value: locationField, inline: true },
			{ name: "Dimension", value: dimensionField, inline: true },
			{ name: "Coordinates", value: coordinateField, inline: true }
		)
	await interaction.reply({embeds: [embed]});
}

/**
 * 
 * @param {ChatInputCommandInteraction | AutocompleteInteraction} interaction 
 */
async function show(interaction) {
	if (interaction.isAutocomplete())
		return handleAutoComplete(interaction);
	else if (!interaction.isChatInputCommand())
		return;
	//

	const locationName = interaction.options.getString("location", true);
	const location = getLocation(locationName);
	
	if (!location)
		return;

	const { dimension } = location
	const { x, y, z } = location.coords;

	const showMinecraft = interaction.options.getBoolean("minecraft")
	if (showMinecraft) 
		await rcon.send(`say Location: ${locationName}, ${dimension}, (x: ${x} y: ${y} z: ${z})`);
	
	const embed = new EmbedBuilder()
		.setTitle("Location - " + locationName)
		.addFields(
			{ name: "Dimension", value: dimension, inline: true },
			{ name: "Coordinates", value: `\`x:${x}, y:${y}, z:${z}\``, inline: true }
		)
		
	return await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * 
 * @param {ChatInputCommandInteraction} interaction 
 */
async function add(interaction) {
	const location = interaction.options.getString("location", true);

	if (getLocation(location))
		return await interaction.reply({
			content: "There's already a saved location named " + location,
			ephemeral: true
		});
	
	
	const dimension = interaction.options.getString("dimension", true);
	const x = interaction.options.getInteger("x", true);
	const y = interaction.options.getInteger("y", true);
	const z = interaction.options.getInteger("z", true);

	const coords = { x: x, y: y, z: z }
	const newLocation = { dimension: dimension, coords: coords };
	locations[location] = newLocation;
	overwriteCoordinates();

	await interaction.reply({
		content: `Added ${location}, ${dimension}, (${x}, ${y}, ${z}) to the list!`,
		ephemeral: true
	});
}

/**
 * 
 * @param {AutocompleteInteraction} interaction 
 */
async function handleAutoComplete(interaction) {
	const foc = interaction.options.getFocused(true);
	if (foc.name != "location")
		return;

	const filtered = getLocationNames().filter(c => c.toLowerCase().startsWith(foc.value));
	const limit = filtered.splice(0, Math.min(25, filtered.length));
	await interaction.respond(limit.map(str => ({ name: str, value: str })));
}

/**
 * 
 * @param {ChatInputCommandInteraction | AutocompleteInteraction} interaction 
 */
async function remove(interaction) {
	if (interaction.isAutocomplete())
		return handleAutoComplete(interaction);
	else if (!interaction.isChatInputCommand())
		return;

	const location = interaction.options.getString("location", true);
	if (!getLocation(location))
		return await interaction.reply({
			content: "There are no saved locations named " + location,
			ephemeral: true
		});
	//

	delete locations[location];
	overwriteCoordinates();
	
	return await interaction.reply({
		content: "Removed " + location + " from the list of locations",
		ephemeral: true
	});
}

async function overwriteCoordinates() {
	const data = JSON.stringify(locations, null, 4);
	await writeFile(resolve(__dirname, "locations.json"), data, {encoding: "utf8"});
}

client.on("interactionCreate", async interaction => {
	if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
		return;

	const subCommand = interaction.options.getSubcommand();
	
	switch (subCommand) {
		case "list":
			//@ts-ignore
			list(interaction);
			break;
		case "show":
			show(interaction);
			break;
		case "add":
			//@ts-ignore
			add(interaction);
			break;
		case "remove":
			remove(interaction);
			break;

		default:
			break;
	}

	
});

/**
 * 
 * @param {import("discord.js").APIEmbedField[]} fields 
 */
function buildNewEmbed(fields = []) {
	return new EmbedBuilder()
		.setDescription(`The following players are online in ${process.env.SERVER_NAME}:`)
		.setTitle(process.env.SERVER_NAME || "")
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
			?.replace(/ +/, "")
			.split(",") 
			.filter(player => player.trim().length);
		
		/** @type {import("discord.js").APIEmbedField[]} */
		const fields = [];
		if (onlineList && onlineList.length) { 
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
			// @ts-ignore
			rcon = await new Rcon(rconConfig).connect() // @ts-ignore
			await playerTracker(rcon);
		} catch (error) {
			console.error(error)
			console.log("Something stinky happened, reconnecting to the RCON server.");
		}
	}
}

login()
