const { SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setactivity')
    .setDescription('Verander de activiteit van de bot')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Het type activiteit')
        .setRequired(true)
        .addChoices(
          { name: 'Playing', value: 'PLAYING' },
          { name: 'Streaming', value: 'STREAMING' },
          { name: 'Listening', value: 'LISTENING' },
          { name: 'Watching', value: 'WATCHING' },
          { name: 'Competing', value: 'COMPETING' }
        ))
    .addStringOption(option =>
      option.setName('text')
        .setDescription('De tekst van de activiteit')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('status')
        .setDescription('De status van de bot')
        .setRequired(false)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const text = interaction.options.getString('text');
    const status = interaction.options.getString('status');
    
    const { leidingRol } = interaction.client.config;
    const hasLeidingRole = interaction.member.roles.cache.has(leidingRol);
    if (!hasLeidingRole) {
      return interaction.reply({ content: 'Je hebt geen toestemming om dit commando te gebruiken!', ephemeral: true });
    }
    
    let activityType;
    switch (type.toUpperCase()) {
      case 'PLAYING':
        activityType = ActivityType.Playing;
        break;
      case 'STREAMING':
        activityType = ActivityType.Streaming;
        break;
      case 'LISTENING':
        activityType = ActivityType.Listening;
        break;
      case 'WATCHING':
        activityType = ActivityType.Watching;
        break;
      case 'COMPETING':
        activityType = ActivityType.Competing;
        break;
      default:
        activityType = ActivityType.Playing;
    }
    
    interaction.client.user.setActivity(text, { type: activityType });
    
    if (status) {
      interaction.client.user.setStatus(status);
    }
    
    const configPath = path.join(__dirname, '../config.yml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    config.activity.type = type;
    config.activity.text = text;
    if (status) {
      config.activity.status = status;
    }
    
    fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }));
    
    interaction.client.config = config;
    
    await interaction.reply({ 
      content: `Bot activiteit succesvol bijgewerkt naar: ${type} ${text}${status ? ` (Status: ${status})` : ''}`, 
      ephemeral: true 
    });
    
    await interaction.client.stuurLog(
      `👤 Admin: <@${interaction.user.id}>\n` +
      `🔄 Bot activiteit bijgewerkt naar: ${type} ${text}${status ? `\n🔄 Status bijgewerkt naar: ${status}` : ''}`,
      'admin'
    );
  }
};
