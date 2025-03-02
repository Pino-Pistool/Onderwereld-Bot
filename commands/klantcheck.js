
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

const getAuthorizedMembers = () => {
  try {
    const data = fs.readFileSync('authorized_members.json', 'utf8');
    return JSON.parse(data) || [];
  } catch (err) {
    console.error('Fout bij het lezen van authorized_members.json:', err);
    return [];
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('klantcheck')
    .setDescription('Controleer of een klant geblacklist is')
    .addStringOption(option =>
      option.setName('naam')
        .setDescription('Naam van de klant')
        .setRequired(true)),

  async execute(interaction) {
    const naam = interaction.options.getString('naam');

    const userId = interaction.user.id;

    const authorizedMembers = getAuthorizedMembers();

    if (!authorizedMembers.includes(userId)) {
      return await interaction.reply({
        content: 'Je hebt geen permissies om dit commando te gebruiken!',
        ephemeral: true,
      });
    }

    let klanten = [];
    try {
      const data = fs.readFileSync('klanten.json', 'utf8');
      klanten = JSON.parse(data);
    } catch (err) {
      console.error('Fout bij het lezen van klanten.json:', err);
      return await interaction.reply({ content: 'Er is een fout opgetreden bij het lezen van de klantenlijst.', ephemeral: true });
    }

    const klant = klanten.find(k => k.naam === naam);

    if (!klant) {
      return await interaction.reply({ content: `Klant "${naam}" niet gevonden.`, ephemeral: true });
    }

    if (klant.blacklisted) {
      await interaction.reply({
        content: `Klant "${naam}" is **geblacklist**. Reden: ${klant.reden || 'Geen reden opgegeven.'}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `Klant "${naam}" is **niet geblacklist**.`,
        ephemeral: true,
      });
    }
  },
};
