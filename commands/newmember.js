const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('newmember')
    .setDescription('Voeg een nieuw ganglid toe')
    .addUserOption(option => 
      option.setName('gebruiker')
        .setDescription('De gebruiker die je wilt toevoegen als ganglid')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('naam')
        .setDescription('De naam van het ganglid')
        .setRequired(true)),
  
  async execute(interaction) {
    const { gangRol, leidingRol } = interaction.client.config;
    
    const hasLeidingRole = interaction.member.roles.cache.has(leidingRol);
    if (!hasLeidingRole) {
      return interaction.reply({ content: 'Je hebt geen toestemming om dit commando te gebruiken!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('gebruiker');
    const naam = interaction.options.getString('naam');
    
    try {
      const geautoriseerdeLedenOp = interaction.client.haalGeautoriseerdeLedenOp();
      
      if (geautoriseerdeLedenOp.includes(user.id)) {
        return interaction.reply({ content: `${user.tag} is al een ganglid!`, ephemeral: true });
      }
      
      geautoriseerdeLedenOp.push(user.id);
      fs.writeFileSync('authorized_members.json', JSON.stringify(geautoriseerdeLedenOp, null, 2));
      
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.add(gangRol);
      
      let gangleden = [];
      try {
        const data = fs.readFileSync('gangleden.json', 'utf8');
        gangleden = JSON.parse(data);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Fout bij het lezen van gangleden.json:', err);
        }
      }
      
      const nieuwLid = {
        userId: user.id,
        username: user.tag,
        naam: naam,
        toegevoegdDoor: interaction.user.tag,
        toegevoegdOp: new Date().toLocaleString()
      };
      
      gangleden.push(nieuwLid);
      fs.writeFileSync('gangleden.json', JSON.stringify(gangleden, null, 2));
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('👥 Nieuw Ganglid Toegevoegd')
        .setDescription(`${user} is succesvol toegevoegd als ganglid!`)
        .addFields(
          { name: 'Naam', value: naam, inline: true },
          { name: 'Discord', value: user.tag, inline: true },
          { name: 'Toegevoegd door', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      
      const newMemberChannel = interaction.client.channels.cache.get(interaction.client.config.newmemberchannel);
      if (newMemberChannel) {
        await newMemberChannel.send({ content: `Welkom ${user}! Je bent toegevoegd als ganglid.`, embeds: [embed] });
      }
      
      await interaction.client.stuurLog(
        `👥 **Nieuw ganglid toegevoegd**\n` +
        `👤 Ganglid: <@${user.id}> (${user.tag})\n` +
        `📝 Naam: ${naam}\n` +
        `👮 Toegevoegd door: <@${interaction.user.id}>`
      );
      
    } catch (error) {
      console.error('Fout bij het toevoegen van nieuw ganglid:', error);
      await interaction.reply({ content: 'Er is een fout opgetreden bij het toevoegen van het ganglid.', ephemeral: true });
    }
  }
};
