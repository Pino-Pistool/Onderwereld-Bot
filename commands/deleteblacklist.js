const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteblacklist')
    .setDescription('Verwijder de blacklist-status van een klant')
    .addStringOption(option =>
      option.setName('klant')
        .setDescription('De naam van de klant')
        .setRequired(true)),

  async execute(interaction) {
    const { leidingRol } = interaction.client.config;

    const hasLeidingRole = interaction.member.roles.cache.has(leidingRol);
    if (!hasLeidingRole) {
      return interaction.reply({ content: 'Je hebt geen toestemming om dit commando te gebruiken!', ephemeral: true });
    }
    
    const klantNaam = interaction.options.getString('klant').trim();

    const klantenFilePath = path.join(__dirname, '../klanten.json');

    let klantenData = [];
    try {
      const data = fs.readFileSync(klantenFilePath, 'utf8');
      klantenData = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van klanten.json:', err);
      }
      return interaction.reply({ content: 'Er is een fout opgetreden bij het lezen van klanten.', ephemeral: true });
    }

    const klantIndex = klantenData.findIndex(item => 
      item.naam && item.naam.toLowerCase() === klantNaam.toLowerCase()
    );

    if (klantIndex === -1) {
      return interaction.reply({
        content: `Klant "${klantNaam}" niet gevonden.`,
        ephemeral: true,
      });
    }

    if (!klantenData[klantIndex].blacklisted) {
      return interaction.reply({
        content: `Klant "${klantNaam}" staat niet op de blacklist.`,
        ephemeral: true,
      });
    }

    klantenData[klantIndex].blacklisted = false;
    klantenData[klantIndex].reden = '';

    fs.writeFileSync(klantenFilePath, JSON.stringify(klantenData, null, 2));

    await interaction.reply({
      content: `Blacklist-status van klant "${klantNaam}" is succesvol verwijderd.`,
      ephemeral: true,
    });
    
    await interaction.client.stuurLog(
      `👤 Admin: <@${interaction.user.id}>\n` +
      `👥 Klant: ${klantNaam}\n` +
      `🔄 Actie: Blacklist status verwijderd`,
      'admin'
    );
  },
};
