const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');


const configPad = path.join(__dirname, 'config.yml');
const config = yaml.load(fs.readFileSync(configPad, 'utf8'));
const { token, clientId, guildId, newmemberchannel, logs, leidingRol, gangRol } = config;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.commands = new Collection();
client.config = config;

const haalGeautoriseerdeLedenOp = () => {
  try {
    const data = fs.readFileSync('authorized_members.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Fout bij het lezen van authorized_members.json:', err);
    return [];
  }
};

const laadCommando = (dir) => {
  const commandoBestanden = fs.readdirSync(dir).filter(bestand => bestand.endsWith('.js'));
  for (const bestand of commandoBestanden) {
    const bestandsPad = path.join(dir, bestand);
    const commando = require(bestandsPad);
    if (commando.data && commando.execute) {
      client.commands.set(commando.data.name, commando);
    } else {
      console.warn(`Commando op ${bestandsPad} mist "data" of "execute" eigenschap.`);
    }
  }
};

const commandoPad = path.join(__dirname, 'commands');
laadCommando(commandoPad);

const laadEvents = (dir) => {
  const eventBestanden = fs.readdirSync(dir).filter(bestand => bestand.endsWith('.js'));
  for (const bestand of eventBestanden) {
    const bestandsPad = path.join(dir, bestand);
    const event = require(bestandsPad);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log(`Event geladen: ${event.name}`);
  }
};

const eventsPad = path.join(__dirname, 'events');
laadEvents(eventsPad);

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    
    console.log('Slash commandos registreren...');
    const commandos = client.commands.map(commando => commando.data.toJSON());

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commandos },
    );

    console.log('Slash commandos succesvol geregistreerd!');
    
    client.login(token);
  } catch (error) {
    console.error('Fout bij het registreren van commandos:', error);
    process.exit(1);
  }
})();


const stuurLog = async (bericht, logType = 'general') => {
  if (!config.logs) {
    console.log("Logs configuratie niet gevonden in config.yml.");
    return;
  }
  
  const kanaalId = config.logs[logType] || config.logs.general;
  
  if (!kanaalId) {
    console.log(`Log kanaal voor ${logType} niet ingesteld in configuratie.`);
    return;
  }
  
  if (!client.isReady()) {
    console.log(`Bot is nog niet klaar om logs te sturen naar ${logType} kanaal.`);
    return;
  }
  
  const kanaal = client.channels.cache.get(kanaalId);
  
  if (kanaal) {
    const embed = new EmbedBuilder()
      .setColor(getLogColor(logType))
      .setTitle(getLogTitle(logType))
      .setDescription(bericht)
      .setTimestamp();

    try {
      await kanaal.send({ embeds: [embed] });
    } catch (err) {
      console.error(`Fout bij het versturen van logbericht naar ${logType} kanaal:`, err);
    }
  } else {
    console.error(`Log kanaal voor ${logType} (ID: ${kanaalId}) niet gevonden!`);
  }
};

function getLogColor(logType) {
  const colors = {
    general: 0x0099FF,
    witwas: 0x00FF00,
    drugs: 0xFF9900,
    admin: 0xFF0000,
    klanten: 0x9900FF,
    wapens: 0x00FFFF,
  };
  
  return colors[logType] || colors.general;
}

function getLogTitle(logType) {
  const titles = {
    general: '📋 Algemene Actie',
    witwas: '💰 Witwas Actie',
    drugs: '🌿 Drugs Actie',
    admin: '👑 Admin Actie',
    klanten: '👥 Klant Actie',
    wapens: '🔫 Wapen Actie'
  };
  
  return titles[logType] || titles.general;
}

client.stuurLog = stuurLog;
client.haalGeautoriseerdeLedenOp = haalGeautoriseerdeLedenOp;
