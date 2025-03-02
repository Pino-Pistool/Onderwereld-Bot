const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wapenaanvraag')
    .setDescription('Vraag een wapen aan bij de leiding')
    .addStringOption(option =>
      option.setName('datum')
        .setDescription('Wanneer heb je het wapen nodig (bijv. "morgen", "vrijdag 20:00")')
        .setRequired(true)),
  
  async execute(interaction) {
    try {
      const { wapens, logs, leidingRol } = interaction.client.config;
      
      const geautoriseerdeLedenOp = interaction.client.haalGeautoriseerdeLedenOp();
      if (!geautoriseerdeLedenOp.includes(interaction.user.id)) {
        return interaction.reply({ content: 'Je bent niet geautoriseerd om dit commando te gebruiken!', ephemeral: true });
      }
      
      let blacklist = [];
      try {
        const blacklistData = fs.readFileSync(path.join(__dirname, '../blacklist.json'), 'utf8');
        blacklist = JSON.parse(blacklistData);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Fout bij het lezen van blacklist.json:', err);
        }
      }

      const isBlacklisted = blacklist.some(entry => entry.userId === interaction.user.id);
      if (isBlacklisted) {
        return interaction.reply({ content: 'Je staat op de blacklist en kunt geen wapen aanvragen!', ephemeral: true });
      }
      
      const datum = interaction.options.getString('datum');
      
      const wapenTypes = wapens && wapens.types ? wapens.types : ["Pistool", "Shotgun", "SMG", "Assault Rifle", "Sniper Rifle"];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('wapen_aanvraag_select')
        .setPlaceholder('Selecteer een wapentype')
        .addOptions(wapenTypes.map(type => ({
          label: type,
          value: type,
          description: `Vraag een ${type} aan (reden volgt)`
        })));

      const row = new ActionRowBuilder().addComponents(selectMenu);

       await interaction.reply({
            content: `Selecteer het type wapen dat je wilt aanvragen en geef een reden:`,
            components: [row],
            ephemeral: true
        });
    }  catch (error) {
      console.error('Fout bij het uitvoeren van wapenaanvraag:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Er is een fout opgetreden bij het uitvoeren van dit commando.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({ content: 'Er is een fout opgetreden bij het uitvoeren van dit commando.', ephemeral: true });
        }
      } catch (replyError) {
        console.error('Fout bij reply:', replyError);
      }
    }
  }
};
