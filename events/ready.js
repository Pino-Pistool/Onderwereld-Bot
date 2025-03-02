const colors = require('ansi-colors');
const { version } = require('../package.json');
const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log('\n' + colors.cyan('═'.repeat(60)));
    
    const botNaam = client.user.username.toUpperCase();
    console.log(colors.bold.green(`
    ██████╗  ██████╗ ████████╗    ${botNaam}
    ██╔══██╗██╔═══██╗╚══██╔══╝    ${colors.yellow(`v${version}`)}
    ██████╔╝██║   ██║   ██║       ${colors.blue('Discord Bot')}
    ██╔══██╗██║   ██║   ██║       
    ██████╔╝╚██████╔╝   ██║       ${colors.magenta('Succesvol gestart!')}
    ╚═════╝  ╚═════╝    ╚═╝       
    `));
    
    console.log(colors.cyan('═'.repeat(60)));
    console.log(colors.bold.white('  Bot Informatie:'));
    console.log(colors.cyan('═'.repeat(60)));
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Naam:')}        ${colors.green(client.user.username)}`);
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('ID:')}          ${colors.green(client.user.id)}`);
    
    const activityConfig = client.config.activity || { status: 'online', type: 'PLAYING', text: 'je commando\'s' };
    
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Status:')}      ${colors.green(activityConfig.status)}`);
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Activiteit:')}  ${colors.green(activityConfig.type)} ${activityConfig.text}`);
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Servers:')}     ${colors.green(client.guilds.cache.size)}`);
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Commando\'s:')} ${colors.green(client.commands.size)}`);
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Gestart op:')}  ${colors.green(new Date().toLocaleString())}`);
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Bot gemaakt door:')}  ${colors.green("SM Development")}`);
    console.log(`  ${colors.yellow('•')} ${colors.bold.white('Discord:')}  ${colors.green('discord.gg/smdevelopment')}`);
    console.log(colors.cyan('═'.repeat(60)) + '\n');
    
    if (client.config.logs) {
        const logChannels = Object.entries(client.config.logs)
            .map(([type, id]) => {
                const channel = client.channels.cache.get(id);
                return `${type}: ${channel ? '✅' : '❌'} (${id})`;
            })
            .join('\n  ');
        console.log(colors.bold.white('  Log Kanalen:'));
        console.log(`  ${logChannels}`);
        console.log(colors.cyan('═'.repeat(60)) + '\n');
    } else {
        console.log(colors.bold.red('  Geen log kanalen geconfigureerd!'));
        console.log(colors.cyan('═'.repeat(60)) + '\n');
    }
    
    let activityType;
    switch (activityConfig.type.toUpperCase()) {
      case 'PLAYING':
        activityType = ActivityType.Playing;
        break;
      case 'STREAMING':
        activityType = ActivityType.Streaming;
        break;
      case 'LISTENING':
        activityType = ActivityType.Listening;
        break;
      case 'WATCHING':
        activityType = ActivityType.Watching;
        break;
      case 'COMPETING':
        activityType = ActivityType.Competing;
        break;
      default:
        activityType = ActivityType.Playing;
    }
    
    client.user.setActivity(activityConfig.text, { type: activityType });
    
    client.user.setStatus(activityConfig.status);
    
    try {
        setTimeout(() => {
            client.stuurLog(
              `Bot succesvol ingelogd als ${client.user.tag}\n` +
              `Status: ${activityConfig.status}\n` +
              `Activiteit: ${activityConfig.type} ${activityConfig.text}`,
              'general'
            );
        }, 1000); 
    } catch (error) {
        console.error('Fout bij het sturen van opstart log:', error);
    }
  }
};
