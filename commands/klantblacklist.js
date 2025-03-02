const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');

const readKlantenFile = () => {
  try {
    return JSON.parse(fs.readFileSync('klanten.json', 'utf8'));
  } catch (err) {
    console.error('Fout bij het lezen van klanten.json:', err);
    return [];
  }
};

const writeKlantenFile = (klanten) => {
  try {
    fs.writeFileSync('klanten.json', JSON.stringify(klanten, null, 2));
  } catch (err) {
    console.error('Fout bij het opslaan van klanten.json:', err);
  }
};

const getPermissionsUser = () => {
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
    .setName('klantblacklist')
    .setDescription('Blacklist een klant')
    .addStringOption(option =>
      option.setName('naam')
        .setDescription('Naam van de klant')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reden')
        .setDescription('Reden voor het blacklisten')
        .setRequired(true)),

  async execute(interaction) {
    const userId = interaction.user.id;

    const permissionsUser = getPermissionsUser();

    if (!permissionsUser.includes(userId)) {
      return await interaction.reply({
        content: 'Je hebt geen permissies om dit commando te gebruiken!',
        ephemeral: true,
      });
    }

    const naam = interaction.options.getString('naam');
    const reden = interaction.options.getString('reden');
    let klanten = readKlantenFile();

    const klantIndex = klanten.findIndex(k => k.naam === naam);
    if (klantIndex !== -1) {
      klanten[klantIndex].blacklisted = true;
      klanten[klantIndex].reden = reden;
      writeKlantenFile(klanten);
      await interaction.reply({ content: `Klant "${naam}" is succesvol geblacklist! Reden: ${reden}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Klant "${naam}" niet gevonden.`, ephemeral: true });
    }
  }
};