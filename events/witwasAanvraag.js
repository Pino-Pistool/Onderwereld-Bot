const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  async execute(interaction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('witwas_aanvraag_modal')
        .setTitle('Aanvraag nieuwe witwas');

      const redenInput = new TextInputBuilder()
        .setCustomId('reden_input')
        .setLabel('Waarom wil je nu witwassen?')
        .setPlaceholder('Geef een goede reden...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const percentageInput = new TextInputBuilder()
        .setCustomId('percentage_input')
        .setLabel('Verliespercentage (1-100%)')
        .setPlaceholder('Voer een getal in tussen 1 en 100')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const redenRow = new ActionRowBuilder().addComponents(redenInput);
      const percentageRow = new ActionRowBuilder().addComponents(percentageInput);
      modal.addComponents(redenRow, percentageRow);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Fout bij openen van de modal:', error);
    }
  },

  async handleModal(interaction) {
    try {
      const reden = interaction.fields.getTextInputValue('reden_input');
      const percentage = parseInt(interaction.fields.getTextInputValue('percentage_input'));

      if (isNaN(percentage) || percentage < 1 || percentage > 100) {
        return interaction.reply({ content: 'Het percentage moet tussen 1 en 100 liggen.', ephemeral: true });
      }

      // Verwerk de aanvraag (stuur bijvoorbeeld een bericht naar een admin kanaal)
      const leidingRol = interaction.client.config.leidingRol;
      const aanvraagEmbed = new EmbedBuilder()
        .setColor(0xFF9900)
        .setTitle('🔄 Witwas Aanvraag')
        .setDescription(`${interaction.user} heeft een witwas aanvraag ingediend.`)
        .addFields(
          { name: 'Reden', value: reden },
          { name: 'Aangevraagd Percentage', value: `${percentage}%` }
        )
        .setTimestamp();

      const aanvraagKanaal = interaction.client.channels.cache.get(interaction.client.config.logs.aanvragen);
      if (aanvraagKanaal) {
        await aanvraagKanaal.send({ content: `<@&${leidingRol}> Er is een nieuwe aanvraag!`, embeds: [aanvraagEmbed] });
      }

      await interaction.reply({ content: 'Je aanvraag is ingediend! De leiding is op de hoogte gebracht.', ephemeral: true });
    } catch (error) {
      console.error('Fout bij verwerken van de modal:', error);
      await interaction.reply({ content: 'Er is iets misgegaan met je aanvraag.', ephemeral: true });
    }
  }
};
