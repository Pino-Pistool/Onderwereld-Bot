const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletemember')
    .setDescription('Verwijder een ganglid')
    .addUserOption(option => 
      option.setName('gebruiker')
        .setDescription('De gebruiker die je wilt verwijderen als ganglid')
        .setRequired(true)),
  
  async execute(interaction) {
    const { leidingRol } = interaction.client.config;

    const hasLeidingRole = interaction.member.roles.cache.has(leidingRol);
    if (!hasLeidingRole) {
      return interaction.reply({ content: 'Je hebt geen toestemming om dit commando te gebruiken!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('gebruiker');

    let geautoriseerdeLedenOp = [];
    try {
      const data = fs.readFileSync(path.join(__dirname, '../authorized_members.json'), 'utf8');
      geautoriseerdeLedenOp = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van authorized_members.json:', err);
      }
      return interaction.reply({ content: 'Er is een fout opgetreden bij het lezen van geautoriseerde leden.', ephemeral: true });
    }

    if (!geautoriseerdeLedenOp.includes(user.id)) {
      return interaction.reply({ content: `${user.tag} is geen ganglid!`, ephemeral: true });
    }

    const nieuweLedenLijst = geautoriseerdeLedenOp.filter(id => id !== user.id);
    fs.writeFileSync(path.join(__dirname, '../authorized_members.json'), JSON.stringify(nieuweLedenLijst, null, 2));

    try {
      const member = await interaction.guild.members.fetch(user.id);
      const { gangRol } = interaction.client.config;
      if (member.roles.cache.has(gangRol)) {
        await member.roles.remove(gangRol);
      }
    } catch (error) {
      console.error('Fout bij het verwijderen van gangrol:', error);
    }

    try {
      let gangleden = [];
      try {
        const data = fs.readFileSync(path.join(__dirname, '../gangleden.json'), 'utf8');
        gangleden = JSON.parse(data);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Fout bij het lezen van gangleden.json:', err);
        }
      }
      
      const nieuweGangleden = gangleden.filter(lid => lid.userId !== user.id);
      fs.writeFileSync(path.join(__dirname, '../gangleden.json'), JSON.stringify(nieuweGangleden, null, 2));
    } catch (error) {
      console.error('Fout bij het verwijderen uit gangleden.json:', error);
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('👥 Ganglid Verwijderd')
      .setDescription(`${user} is succesvol verwijderd als ganglid!`)
      .addFields(
        { name: 'Discord', value: user.tag, inline: true },
        { name: 'Verwijderd door', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
    await interaction.client.stuurLog(
      `👤 Admin: <@${interaction.user.id}>\n` +
      `👥 Ganglid verwijderd: <@${user.id}> (${user.tag})`,
      'admin'
    );
  }
};
