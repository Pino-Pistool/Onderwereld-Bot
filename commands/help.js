const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Toont informatie over de beschikbare commando\'s'),
  
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🔍 Help Commando\'s')
      .setDescription('Hier zijn alle beschikbare commando\'s:')
      .addFields(
        { name: '🌿 Drugs Commando\'s', value: 
          '`/drugscheck` - Bekijk welke drugs beschikbaar zijn\n' +
          '`/drugsleveren` - Lever drugs aan een klant'
        },
        { name: '💰 Witwas Commando\'s', value: 
          '`/witwas` - Was geld wit\n' +
          '`/witwascheck` - Controleer witwas informatie'
        },
        { name: '👥 Klant Commando\'s', value: 
          '`/klantcheck` - Controleer klant informatie\n' +
          '`/klantcreate` - Maak een nieuwe klant aan\n' +
          '`/klantdelete` - Verwijder een klant\n' +
          '`/klantenlijst` - Bekijk alle klanten\n' +
          '`/klantblacklist` - Zet een klant op de blacklist'
        },
        { name: '🛠️ Admin Commando\'s', value: 
          '`/newmember` - Voeg een nieuw ganglid toe\n' +
          '`/deletemember` - Verwijder een ganglid\n' +
          '`/deleteblacklist` - Verwijder een klant van de blacklist\n' +
          '`/veranderinfo` - Verander informatie van een ganglid'
        }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
