const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (!interaction.isCommand() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isButton()) return;

    const commando = client.commands.get(interaction.commandName);
    if (!commando) {
      console.error(`Commando niet gevonden: ${interaction.commandName}`);
      return;
    }

    try {
      await commando.execute(interaction);
    } catch (error) {
      console.error(`Fout bij het uitvoeren van commando ${interaction.commandName}:`, error);
      await client.stuurLog(`Fout bij het uitvoeren van commando ${interaction.commandName}: ${error.message}`);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Er is een fout opgetreden bij het uitvoeren van dit commando!', ephemeral: true });
      }
    }
  }
};
