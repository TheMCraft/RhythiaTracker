require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const axios = require('axios');

let lastUpdate = 0;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', Partials.Channel]
});


client.once('ready', () => {
  console.log('Bot ist online!');
  updateLeaderboard("auto");
  setInterval(() => updateLeaderboard("auto"), 3600000)
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channel.type === 1) {
    if (message.content.length < 1200 || message.content.length > 1700) {
      await message.reply("Das ist keine gültige Session-ID!");
      return;
    }
    try {
      const res = await axios.post(
        "https://production.rhythia.com/api/acceptInvite",
        JSON.stringify({
          code: process.env.CLANCODE,
          session: message.content.replace(/"/g, "")
        }),
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
      await message.reply(`Status Code: ${res.status}, Text: ${JSON.stringify(res.data)}`);
    } catch (err) {
      await message.reply("Fehler beim Verarbeiten der Anfrage.");
    }
    return;
  }
  

  if (message.content.toLowerCase() === '!update') {
    message.delete();
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Du benötigst Administratorrechte, um diesen Befehl auszuführen.');
    }
    updateLeaderboard(message.member.id);
  }

  if (message.content.toLowerCase().startsWith('!setuser')) {
    message.delete();
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Du benötigst Administratorrechte, um diesen Befehl auszuführen.');
    }
    const args = message.content.split(' ');
    if (args.length !== 3) {
      return message.reply('Verwendung: !setuser [rhythiaid] [discordid]');
    }

    const id = args[1];
    const discordid = args[2];
    const members = JSON.parse(fs.readFileSync('members.json', 'utf8'));
    members[id] = discordid;
    fs.writeFileSync('members.json', JSON.stringify(members, null, 2));
    message.reply(`Rhythia-ID ${id} wurde mit Discord-ID ${discordid} hinzugefügt/aktualisiert.`);
  }

  if (message.content.toLowerCase() === '!leaderboard') {
    message.delete();
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Du benötigst Administratorrechte, um diesen Befehl auszuführen.');
    }

    let msg = "loading...";
    const sentMessage = await message.channel.send(msg);
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    config.leaderboardMessageId = sentMessage.id;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    updateLeaderboard("auto");
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
  if (reaction.message.id !== config.leaderboardMessageId) return;

  await reaction.users.remove(user.id);

  const now = Date.now();
  if (now - lastUpdate > 60000) {
    await updateLeaderboard(user.id);
    lastUpdate = now;
  }
});

async function updateLeaderboard(reason) {
  try {
    const response = await axios.post("https://development.rhythia.com/api/getClan", {
      "id": 27,
      "session": process.env.SESSION
    });

    if (response.status === 421) {
      console.error('Fehler 421: Rate Limiting oder ungültige Anfrage.');
      return;
    }

    const leaderboardAT = await axios.post("https://development.rhythia.com/api/getLeaderboard", {
      "flag": "AT",
      "page": 1,
      "session": process.env.SESSION,
      "spin": false
    });

    const leaderboardDE = await axios.post("https://development.rhythia.com/api/getLeaderboard", {
      "flag": "DE",
      "page": 1,
      "session": process.env.SESSION,
      "spin": false
    });

    const leaderboardCH = await axios.post("https://development.rhythia.com/api/getLeaderboard", {
      "flag": "CH",
      "page": 1,
      "session": process.env.SESSION,
      "spin": false
    });
    const users = response.data.users;

    users.sort((a, b) => b.skill_points - a.skill_points);

    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    const leaderboardMessage = await client.channels.cache
      .get(config.channelId)
      .messages.fetch(config.leaderboardMessageId);

      let message = "# TOP 10 UwU Clan\n";
      users.forEach((entry, index) => {
        if (index < 10) {
          message += `${index + 1}. :flag_${entry.flag.toLowerCase()}: [${entry.username.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{E0020}-\u{E007F}]/gu, '')}](<https://www.rhythia.com/player/${entry.id}>)`;

          if (getDiscordID(entry.id)) {
              message += ` - <@${getDiscordID(entry.id)}>`;
          }
          leaderboardAT.data.leaderboard.forEach((user, index) => {
            if (user.id === entry.id) {
              message += `\n**#${index + 1} :flag_at: Österreich**`
            }
          });
          leaderboardDE.data.leaderboard.forEach((user, index) => {
            if (user.id === entry.id) {
              message += `\n**#${index + 1} :flag_de: Deutschland**`
            }
          });
          leaderboardCH.data.leaderboard.forEach((user, index) => {
            if (user.id === entry.id) {
              message += `\n**#${index + 1} :flag_ch: Schweiz**`
            }
          });
          message += `\nSkill Points: \`${entry.skill_points.toFixed(2)}\`\n\n`;
      }
    });
    const now = new Date();
    const timestamp = now.toLocaleString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    message += `\n_Zuletzt aktualisiert am ${timestamp.replace(',', ' um')} (${(reason === "auto") ? "Automatisch" : "Manuell von <@" + reason + ">"})_`;



    await leaderboardMessage.edit({
        content: message,
        embeds: [],
      });
    await leaderboardMessage.react('🔁');
  } catch (error) {
    console.error('Fehler beim Abrufen der Leaderboard-Daten:', error);
  }
}

function getDiscordID(rhythiaid) {
    const members = JSON.parse(fs.readFileSync('members.json', 'utf8'));
    return members[rhythiaid] || null;
}

client.login(process.env.DISCORD_TOKEN);
