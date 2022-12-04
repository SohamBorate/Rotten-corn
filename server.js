const dotenv = require("dotenv").config();
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const https = require("https");
const Youtube = require("youtube-sr").default;
const ytdl = require("ytdl-core");
const ytc = require("yt-converter");
const { Client, Intents, MessageEmbed, MessageAttachment, MessageActionRow, MessageButton } = require("discord.js");
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

// variables
const token = process.env.TOKEN;
const prefix = process.env.PREFIX;
const inviteLink = process.env.INVITE_LINK;
const themeColor = "#FFBF00";

// create audio folder if it doesnt exist
var dir = `${__dirname}\\audio`;
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

// client status
client.once("ready", () => {
	console.log("Ready!");
});
client.once("reconnecting", () => {
    console.log("Reconnecting!");
});
client.once("disconnect", () => {
    console.log("Disconnect!");
});

// interaction
client.on("interactionCreate", interaction => {
	if (!interaction.isButton()) {return}
	let config = interaction.customId.split(" ");
	let type = config[0];
	if (type === "TTC") {
		let id = config[1];
		let slot = config[2];
		sessions.forEach((session, index) => {
			if (session.id === id) {
				session.buttonClick(slot, interaction);
			}
		});
	}
});

// random
getRandomInt = (max) => {
    return Math.floor(Math.random() * max);
}

// download process
var queue = new Map();
class DownloadProcess {
	constructor(videoData) {
		this.videoData = videoData;
		return this;
	}

	sendTo = [];

	download = () => {
		ytc.convertAudio({
			url: videoData.url,
			itag: 140,
			directoryDownload: `${__dirname}\\audio`,
		}, () => { }, () => {
			let file = new MessageAttachment(`${__dirname}/audio/${videoData.title}.mp3`);
			this.sendTo.forEach((message, index) => {
				message.channel.send({ content: `<@${message.author.id}> here you go :)`, files: [file] });
			});
			queue.delete(videoData.title);
		});
	}

	addReceiver = (message) => {
		this.sendTo[this.sendTo.length + 1] = message;
	}
}

// download audio
var downloadAudio = (videoData, message) => {
	if (fs.existsSync(`${__dirname}/audio/${videoData.title}.mp3`)) {
		let file = new MessageAttachment(`${__dirname}/audio/${videoData.title}.mp3`);
		message.channel.send({ content: `<@${message.author.id}> here you go :)`, files: [file] });
		return;
	}
	if (queue.get(videoData.title)) {
		queue.get(videoData.title).addReceiver(message);
	} else {
		let process = new DownloadProcess(videoData);
		queue.set(videoData.title, process);
		process.addReceiver(message);
		process.download();
	}
}

// tic tac toe session
const sessions = [];
class TtcSession {
	constructor(player1, player2) {
		this.player1 = player1;
		this.player2 = player2;
		return this;
	}

	id = uuidv4();
	ended = false;
	boxData = {}
	gameData = {
		player1: "O",
		player2: "X",
		playing: "player2",
		timeRemaining: 15
	}

	timer = () => {
		if (this.ended) { return; }
		this.gameData.timeRemaining--;
		if (this.gameData.timeRemaining < 1) {
			this.end("everyone left? fine.");
			return;
		}
		setTimeout(() => {
			this.timer();
		}, 1000);
	}

	checkForWin = (char) => {
		let winConditions = [];
		// row
		winConditions.push(["A1", "A2", "A3"]);
		winConditions.push(["B1", "B2", "B3"]);
		winConditions.push(["C1", "C2", "C3"]);
		// column
		winConditions.push(["A1", "B1", "C1"]);
		winConditions.push(["A2", "B2", "C2"]);
		winConditions.push(["A3", "B3", "C3"]);
		// diagonal
		winConditions.push(["A1", "B2", "C3"]);
		winConditions.push(["A3", "B2", "C1"]);

		for (let i = 0; i < winConditions.length; i++) {
			let condition = winConditions[i];
			let match = 0;
			condition.forEach((slot, index) => {
				if (this.boxData[slot] === char) {
					match++;
				}
			});
			if (match === 3) {
				return match;
			}
		}
	}

	buttonClick = (slot, interaction) => {
		let user = interaction.member.user;

		if (user.id === this.player1.id) {
			if (this.gameData.playing === "player1") {
				this.boxData[slot] = this.gameData.player1;
				this.gameData.playing = ("player2");
				this.gameData.timeRemaining = 15;
				this.checkForWin(this.gameData.player1);
				if (Object.keys(this.boxData).length === 9) {
					this.end("ended in a draw", interaction);
				} else if (this.checkForWin(this.gameData.player1) === 3) {
					this.end(`<@${this.player1.id}> (**${this.gameData.player1}**) won`, interaction);
				} else {
					let box = this.buildBox(this.boxData);
					interaction.update(box);
				}
			} else {
				interaction.reply({ content: "not your turn", ephemeral: true });
			}
		} else if (user.id === this.player2.id) {
			if (this.gameData.playing === "player2") {
				this.boxData[slot] = this.gameData.player2;
				this.gameData.playing = ("player1");
				this.gameData.timeRemaining = 15;
				this.checkForWin(this.gameData.player2);
				if (Object.keys(this.boxData).length === 9) {
					this.end("ended in a draw", interaction);
				} else if (this.checkForWin(this.gameData.player2) === 3) {
					this.end(`<@${this.player2.id}> (**${this.gameData.player2}**) won`, interaction);
				} else {
					let box = this.buildBox(this.boxData);
					interaction.update(box);
				}
			} else {
				interaction.reply({ content: "not your turn", ephemeral: true });
			}
		} else {
			interaction.reply({ content: "you aren't playing", ephemeral: true });
		}
	}

	buildBox = (boxData) => {
		if (this.ended) { return; }
		let player1name = this.player1.username;
		let player2name = this.player2.username;
		let playingId = this[this.gameData.playing].id;
		let playingChar = this.gameData[this.gameData.playing];
		let timeRemaining = this.gameData.timeRemaining;
		let content = `${player1name} vs ${player2name}\n\n<@${playingId}>\'s move (**${playingChar}**)\nyou have ${timeRemaining} seconds`;

		let rows = ["A", "B", "C"];
		let messageComponent = [];
		rows.forEach((rowIndex, index) => {
			let row = new MessageActionRow();
			for (let i = 1; i < 4; i++) {
				let button = new MessageButton();
				button.setCustomId(`TTC ${this.id} ${rowIndex}${i}`);
				button.setStyle("SECONDARY");
				button.setLabel(boxData[`${rowIndex}${i}`] || " ");
				button.setDisabled(boxData[`${rowIndex}${i}`] ? true : false);
				row.addComponents(button);
			}
			messageComponent.push(row);
		});

		return { content: content, components: messageComponent };
	}

	begin = (message) => {
		// randomize
		let int = getRandomInt(2);
		let player = ((int === 0) ? "player1" : "player2");
		int = getRandomInt(2);
		let char1 = ((int === 0) ? "O" : "X");
		let char2 = ((char1 === "O") ? "X" : "O");
		this.gameData.playing = player;
		this.gameData.player1 = char1;
		this.gameData.player2 = char2;
		// build box
		let box = this.buildBox({});
		let msg = message.channel.send(box);
		msg.then((playbox) => {
			this.playbox = playbox;
		});
		// begin timer
		setTimeout(() => {
			this.timer();
		}, 1000);
	}

	end = (endMessage, interaction) => {
		this.ended = true;
		sessions.forEach((session, index) => {
			if (session.id === this.id) {
				sessions.pop(index);
			}
		});

		let player1name = this.player1.username;
		let player2name = this.player2.username;
		let content = `${player1name} vs ${player2name}\n\n${endMessage}`;

		let rows = ["A", "B", "C"];
		let messageComponent = [];
		rows.forEach((rowIndex, index) => {
			let row = new MessageActionRow();
			for (let i = 1; i < 4; i++) {
				let button = new MessageButton();
				button.setCustomId(`TTC ${this.id} ${rowIndex}${i}`);
				button.setStyle("SECONDARY");
				button.setLabel(this.boxData[`${rowIndex}${i}`] || " ");
				button.setDisabled(true);
				row.addComponents(button);
			}
			messageComponent.push(row);
		});

		if (interaction) {
			interaction.update({ content: content, components: messageComponent });
		} else {
			this.playbox.edit({ content: content, components: messageComponent });
		}
	}
}

// commands
const commands = new Map();

commands.set(`${prefix}download`, {
	title: `${prefix}download <song name> | <youtube url>`,
	description: "download a song straight from youtube",
	function: (message) => {
		let messageSplit = message.content.split(" ");
		var query = messageSplit[1];
	
		if (query.includes("https://www.youtube.com/")) {
			if (ytdl.validateURL(query)) {
				// get id and download
				let ytVideo = Youtube.getVideo(query)
				ytVideo.then((ytVideoData) => {
					downloadAudio(ytVideoData, message);
				});
			} else {
				message.channel.send("Invalid YouTube URL");
			}
		} else {
			// combine search query
			query = "";
			for (let i = 1; i < messageSplit.length; i++) {
				if (i + 1 === messageSplit.length) {
					query = query + messageSplit[i];
				} else {
					query = query + messageSplit[i] + " ";
				}
			}
			// download song
			let ytSearch = Youtube.searchOne(query);
			ytSearch.then((ytSearchData) => {
				downloadAudio(ytSearchData, message);
			});
		}
	}
});

commands.set(`${prefix}tictactoe`, {
	title: `${prefix}tictactoe <user>`,
	description: "play a fun game of tic tac toe with your friends",
	function: (message) => {
		let selfTag = false;
		if (message.mentions.everyone) {
			return message.channel.send("one at a time please");
		}
		if (message.mentions.roles.size !== 0) {
			return message.channel.send("lol nice try");
		}
		if (message.mentions.users.size === 0) {
			return message.channel.send("you need to tag a valid user to play against");
		}
		message.mentions.users.forEach((user, id) => {
			if (id === message.author.id) {
				message.channel.send("you can't play with yourself");
				selfTag = true;
			}
		});
		if (selfTag) { return; }
	
		let player2 = Array.from(message.mentions.users.values())[0];
		if (player2.id === client.user.id) {
			return message.channel.send("no");
		}
		if (player2.bot) {
			return message.channel.send("the bot said no");
		}
		if (player2.system) {
			return message.channel.send("uhh");
		}
	
		let player1 = message.author;
		let session = new TtcSession(player1, player2, message);
		sessions.push(session);
		session.begin(message);
	}
});

commands.set(`${prefix}weather`, {
	title: `${prefix}weather <location>`,
	description: "look up the weather at a particular location",
	function: (message) => {
		let messageSplit = message.content.split(" ");
		var city = "";
		for (let i = 1; i < messageSplit.length; i++) {
			if (i + 1 === messageSplit.length) {
				city = city + messageSplit[i];
			} else {
				city = city + messageSplit[i] + " ";
			}
		}
	
		let query = city;
		let apiKey = "0adf8bf49972ff8e8d643c1b06088c08";
		let unit = "metric";
		let url = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${apiKey}&units=${unit}`;
	
		https.get(url, (res) => {
			res.on("data", (data) => {
				let weatherData = JSON.parse(data);
				let embed = new MessageEmbed();
				embed.setColor(themeColor);
				if (weatherData.cod === 200) {
					let temp = weatherData.main.temp;
					let tempFeelsLike = weatherData.main.feels_like
					let humidity = weatherData.main.humidity;
					let weatherMain = weatherData.weather[0].main;
					let weatherDescription = weatherData.weather[0].description;
					let weatherIcon = weatherData.weather[0].icon;
					let iconUrl = `http://openweathermap.org/img/wn/${weatherIcon}@2x.png`;
	
					embed.setTitle(`${query} weather`);
					embed.setThumbnail(iconUrl);
					embed.addField(weatherMain, weatherDescription);
					embed.addField("Temperature", `${temp} °C`);
					embed.addField("Temperature feels like", `${tempFeelsLike} °C`);
					embed.addField("Humidity", `${humidity} %`);
					embed.setTimestamp();
	
					message.channel.send({ embeds: [embed] });
				} else {
					embed.addField(`Error code ${weatherData.cod}`, weatherData.message);
					embed.setTimestamp();
	
					message.channel.send({ embeds: [embed] });
				}
			});
		});
	}
});

commands.set(`${prefix}invite`, {
	title: `${prefix}invite`,
	description: "add Rotten corn to your server with the invite link",
	function: (message) => {
		message.channel.send(`here's the invite link for Rotten corn: ${inviteLink}`);
	}
});

commands.set(`${prefix}help`, {
	title: `${prefix}help`,
	description: "list of commands for Rotten corn",
	function: (message) => {
		let embed = new MessageEmbed();
		embed.setTitle("Rotten corn commands");
		embed.setColor("#FFBA01");
		commands.forEach((command, key) => {
			embed.addField(command.title, command.description);
		});
		message.channel.send({ embeds: [embed] });
	}
});

// input
client.on("messageCreate", (message) => {
    let messageSplit = message.content.split(" ")
    let command = commands.get(messageSplit[0]);
    if (!command) {return;}
    command.function(message);
});

client.login(token);