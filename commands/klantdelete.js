const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const configPath = path.join(__dirname, '../config.yml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

const readKlantenFile = () => {
  try {
    return JSON.parse(fs.readFileSync('klanten.json', 'utf8'));
  } catch (err) {
    console.error('Fout bij het lezen van klanten.json:', err);
    return [];
  }
};

const readWitwasFile = () => {
  try {
    return JSON.parse(fs.readFileSync('witwas.json', 'utf8'));
  } catch (err) {
    console.error('Fout bij het lezen van witwas.json:', err);
    return [];
  }
};

const readLeverFile = () => {
  try {
    return JSON.parse(fs.readFileSync('leveren.json', 'utf8'));
  } catch (err) {
    console.error('Fout bij het lezen van leveren.json:', err);
    return [];
  }
};

const deleteKlantData = (naam) => {
  let klanten = readKlantenFile();
  let witwasData = readWitwasFile();
  let leverenData = readLeverFile();

  klanten = klanten.filter(klant => klant.naam !== naam);

  witwasData = witwasData.filter(item => item.klant !== naam);

  leverenData = leverenData.filter(item => item.klant !== naam);

  try {
    fs.writeFileSync('klanten.json', JSON.stringify(klanten, null, 2));
    fs.writeFileSync('witwas.json', JSON.stringify(witwasData, null, 2));
    fs.writeFileSync('leveren.json', JSON.stringify(leverenData, null, 2));
  } catch (err) {
    console.error('Fout bij het opslaan van bestanden:', err);
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('klantdelete')
    .setDescription('Verwijder een klant uit de klantenlijst, drugsleveren lijst, witwaslijst')
    .addStringOption(option =>
      option.setName('naam')
        .setDescription('De naam van de klant')
        .setRequired(true)),

  async execute(interaction) {
    const naam = interaction.options.getString('naam');

    if (!config.permissionsUsers.includes(interaction.user.id)) {
      return await interaction.reply({
        content: 'Je hebt niet de benodigde permissies om dit commando uit te voeren.',
        ephemeral: true
      });
    }

    let klanten = readKlantenFile();

    const klantIndex = klanten.findIndex(klant => klant.naam === naam);

    if (klantIndex === -1) {
      return await interaction.reply({ content: `Klant "${naam}" niet gevonden.`, ephemeral: true });
    }

    deleteKlantData(naam);

    await interaction.reply({ content: `Klant "${naam}" succesvol verwijderd uit zowel de klantenlijst, witwasgegevens als de drugsleveren lijst.`, ephemeral: true });
  }
};
