require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const axios = require('axios')
const config = require("./config.json");
const Canvas = require('canvas');
const fs = require('fs');



if (!process.env.BOT_TOKEN) return console.log('Missing BOT_TOKEN')
if (!process.env.GUILD_ID) return console.log('Missing GUILD_ID')
if (!config.version) return console.log('Missing version')
if (!process.env.HOOK_TOKEN) return console.log('Missing BOT_TOKEN')
if (!process.env.BOT_ID) return console.log('Missing BOT_TOKEN')


let recentKill = 0
let members = []

const webhookClient = new Discord.WebhookClient(process.env.BOT_ID, process.env.HOOK_TOKEN);

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    await getMemberList()
    await deathsStart()
    await setKills()
    setInterval(async () => {
        await checkKills()
    }, 120000)
    setInterval(async () => {
        await getDeaths()
    }, 300000)
    setInterval(async () => {
        await checkPlayers()
    }, 3600000)

});

client.login(process.env.BOT_TOKEN);


const checkKills = async () => {
    console.log('Wyszukiwanie zabójstwa...')
    await axios.get('https://gameinfo.albiononline.com/api/gameinfo/events?limit=20&offset=1&guildId=' + process.env.GUILD_ID + '&t=' + Date.now(), {
        headers: {
            'pragma': 'no-cache',
            'cache-control': 'no-cache',
            'Expires': '0',
        }
    })
        .then(async (response) => {
            for (kill of response.data) {
                if (kill.TimeStamp > recentKill) {
                    await drawEvent(kill.Killer, kill.Victim, kill.TotalVictimKillFame, kill.groupMemberCount, kill.Participants, kill.TimeStamp, kill.EventId, '#00ff66')
                }
            }
            if (response.data[0].TimeStamp > recentKill) {
                recentKill = response.data[0].TimeStamp
            }
        })
        .catch((e) => {
            console.log(e)
            saveLog(e);
        })
}

const setKills = async () => {
    console.log('Pobieranie ID najnowszego killa...')
    await axios.get('https://gameinfo.albiononline.com/api/gameinfo/events?limit=1&offset=1&guildId=' + process.env.GUILD_ID + '&t=' + Date.now(), {
        headers: {
            'pragma': 'no-cache',
            'cache-control': 'no-cache',
            'Expires': '0',
        }
    })
        .then((response) => {
            recentKill = response.data[0].TimeStamp
            console.log(recentKill)
        })
        .catch(async (e) => {
            console.log(e)
            saveLog(e);
            await setKills();
        })
}

const getMemberList = async () => {
    console.log('Pobieranie listy członków gildii...')
    await axios.get('https://gameinfo.albiononline.com/api/gameinfo/guilds/' + process.env.GUILD_ID + '/members')
        .then((response) => {
            let i = 0
            for (player of response.data) {
                members[i] = { playerId: player.Id, EventId: null, TimeStamp: null }
                i++
            }
            console.log('Załadowano ' + members.length + ' członków gildii')
            console.log('Pobieranie zakończone')
        })
        .catch(async (e) => {
            console.log(e)
            await getMemberList()
        })
}

const checkPlayers = async () => {
    members.map(async (player, index) => {
        await axios.get('https://gameinfo.albiononline.com/api/gameinfo/players/' + player.playerId + '&t=' + Date.now())
            .then((response) => {
                if (response.data.length > 0) return
                members.splice(index, 1)

                //console.log(response)
            })
            .catch((e) => {
                console.log(e)
            })
    })
    await axios.get('https://gameinfo.albiononline.com/api/gameinfo/guilds/' + process.env.GUILD_ID + '/members')
        .then((response) => {
            response.data.map((element, index) => {
                if (members.findIndex(member => member.playerId == element.Id) == -1) {
                    members.push({ playerId: element.Id, EventId: null, TimeStamp: null })
                    console.log(members)
                }
            })
        })
        .catch((e) => {
            console.log(e)
        })
}

const deathsStart = async () => {
    console.log('POBIERANIE OSTATNICH ŚMIERCI...')
    let numbersOfMembers = members.length
    for (let player of members) {
        await axios.get('https://gameinfo.albiononline.com/api/gameinfo/players/' + player.playerId + '/deaths?t=' + Date.now(), {
            headers: {
                'pragma': 'no-cache',
                'cache-control': 'no-cache',
                'Expires': '0',
            }
        })
            .then((response) => {
                if (response.data != null && response.data.length > 0) {
                    player.TimeStamp = response.data[0].TimeStamp // Weź ostatnią śmierć każdego gracza
                    console.log(--numbersOfMembers + ' left...')
                }
            })
            .catch(async (e) => {
                console.log(e)
                saveLog(e);
                await deathsStart();
            })
    }
    console.log('POBIERANIE ZAKOŃCZONE')
}

const getDeaths = async () => {

    console.log('Pobieranie deda')
    for (let player of members) {
        await axios.get('https://gameinfo.albiononline.com/api/gameinfo/players/' + player.playerId + '/deaths?t=' + Date.now(), {
            headers: {
                'pragma': 'no-cache',
                'cache-control': 'no-cache',
                'Expires': '0',
            }
        })
            .then(async (response) => {
                if (response.data != null && response.data.length > 0) {
                    if (response.data[0].TimeStamp != player.TimeStamp && response.data[0].TimeStamp > player.TimeStamp) {
                        console.log('Rysujemy dędke')
                        player.TimeStamp = response.data[0].TimeStamp
                        await drawEvent(response.data[0].Killer, response.data[0].Victim, response.data[0].TotalVictimKillFame, response.data[0].groupMemberCount, response.data[0].Participants, response.data[0].TimeStamp, response.data[0].EventId, '#ff0019')
                    }
                }
            })
            .catch((e) => {
                saveLog(e);
            })
    }
}

const drawEvent = async (Killer, Victim, TotalVictimKillFame, groupMemberCount, Participants, TimeStamp, EventId, color) => {
    console.log('Generowanie wiadomości...')
    const canvas = Canvas.createCanvas(1280, 720);
    const ctx = canvas.getContext('2d');
    const background = await Canvas.loadImage('./img/killbotBg.png')
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height)
    ctx.textBaseline = "middle";
    ctx.font = '24px Comic Sans MS'
    ctx.fillStyle = '#000000'
    ctx.textAlign = "center";

    console.log('Draw text...')
    //Killer Name
    ctx.moveTo(0, 0)
    ctx.fillText(Killer.Name, 272.5, 136)

    //Killer Guild
    ctx.fillText((Killer.AllianceName ? ('[' + Killer.AllianceName + '] ' + Killer.GuildName) : (Killer.GuildName)), 272.5, 167)

    //Killer IP
    ctx.fillText('IP ' + parseInt(Killer.AverageItemPower), 386 + 83 / 2, 582 + 9)

    //Victim Name
    ctx.fillText(Victim.Name, 975 + 69 / 2, 136)

    //Victim Guild
    ctx.fillText((Victim.AllianceName ? ('[' + Victim.AllianceName + '] ' + Victim.GuildName) : (Victim.GuildName)), 936 + 148 / 2, 167)

    //Victim IP
    ctx.fillText('IP ' + parseInt(Victim.AverageItemPower), 1119 + 88 / 2, 582 + 9)

    //DPS stats
    let i = 0

    for (player of Participants) {
        //participant weapon
        let part = await Canvas.loadImage('https://render.albiononline.com/v1/item/' + (player.Equipment.MainHand ? player.Equipment.MainHand.Type : 'T8_TRASH') + '.png?count=1&quality=' + (player.Equipment.MainHand ? player.Equipment.MainHand.Quality : ''));
        ctx.drawImage(part, 32 + (272 * i), 30, 62, 62)

        //participant name
        ctx.fillStyle = '#000000'
        ctx.font = '18px Comic Sans MS'
        ctx.textAlign = "left";
        ctx.fillText(player.Name, 100 + (272 * i), 53 + 14 / 2)

        //participant guild and ally
        ctx.font = '13px Comic Sans MS'
        ctx.fillText((player.AllianceName ? ('[' + player.AllianceName + '] ' + player.GuildName) : (player.GuildName)), 100 + (272 * i), 39)

        ctx.font = '18px Comic Sans MS'
        if (player.DamageDone < player.SupportHealingDone) {
            ctx.fillStyle = '#37C320'
            ctx.fillText(parseInt(player.SupportHealingDone), 106 + (272 * i), 88)
        } else {
            ctx.fillStyle = '#C32020'
            ctx.fillText(parseInt(player.DamageDone), 106 + (272 * i), 88)
        }

        i++
    }

    console.log('Draw Images...')

    //Killer Gear

    ctx.fillStyle = '#ffffff'
    ctx.font = '18px Comic Sans MS'
    ctx.textAlign = "center";

    if (Killer.Equipment.MainHand) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.MainHand.Type + '.png?count=1&quality=' + Killer.Equipment.MainHand.Quality)
            .then((image) => {
                ctx.drawImage(image, 79, 316, 135, 127)
                ctx.fillText(Killer.Equipment.MainHand.Count, 181, 410)
            })
    }

    if (Killer.Equipment.OffHand) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.OffHand.Type + '.png?count=1&quality=' + Killer.Equipment.OffHand.Quality)
            .then((image) => {
                ctx.drawImage(image, 334, 316, 135, 127)
                ctx.fillText(Killer.Equipment.OffHand.Count, 437, 410)
            })
    }

    if (Killer.Equipment.Head) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Head.Type + '.png?count=1&quality=' + Killer.Equipment.Head.Quality)
            .then((image) => {
                ctx.drawImage(image, 204, 201, 135, 127)
                ctx.fillText(Killer.Equipment.Head.Count, 306, 294)
            })
    }

    if (Killer.Equipment.Armor) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Armor.Type + '.png?count=1&quality=' + Killer.Equipment.Armor.Quality)
            .then((image) => {
                ctx.drawImage(image, 204, 316, 135, 127)
                ctx.fillText(Killer.Equipment.Armor.Count, 306, 410)
            })
    }

    if (Killer.Equipment.Shoes) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Shoes.Type + '.png?count=1&quality=' + Killer.Equipment.Shoes.Quality)
            .then((image) => {
                ctx.drawImage(image, 204, 430, 135, 127)
                ctx.fillText(Killer.Equipment.Shoes.Count, 306, 525)
            })
    }

    if (Killer.Equipment.Bag) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Bag.Type + '.png?count=1&quality=' + Killer.Equipment.Bag.Quality)
            .then((image) => {
                ctx.drawImage(image, 53, 191, 135, 127)
                ctx.fillText(Killer.Equipment.Bag.Count, 155, 287)
            })
    }

    if (Killer.Equipment.Cape) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Cape.Type + '.png?count=1&quality=' + Killer.Equipment.Cape.Quality)
            .then((image) => {
                ctx.drawImage(image, 360, 191, 135, 127)
                ctx.fillText(Killer.Equipment.Cape.Count, 462, 287)
            })
    }

    if (Killer.Equipment.Mount) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Mount.Type + '.png?count=1&quality=' + Killer.Equipment.Mount.Quality)
            .then((image) => {
                ctx.drawImage(image, 204, 543, 135, 127)
                ctx.fillText(Killer.Equipment.Mount.Count, 306, 638)
            })
    }

    if (Killer.Equipment.Potion) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Potion.Type + '.png?count=1&quality=' + Killer.Equipment.Potion.Quality)
            .then((image) => {
                ctx.drawImage(image, 360, 443, 135, 127)
                ctx.fillText(Killer.Equipment.Potion.Count, 462, 538)
            })
    }

    if (Killer.Equipment.Food) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Killer.Equipment.Food.Type + '.png?count=1&quality=' + Killer.Equipment.Food.Quality)
            .then((image) => {
                ctx.drawImage(image, 53, 443, 135, 127)
                ctx.fillText(Killer.Equipment.Food.Count, 155, 538)
            })
    }

    //Victim Gear

    if (Victim.Equipment.MainHand) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.MainHand.Type + '.png?count=1&quality=' + Victim.Equipment.MainHand.Quality)
            .then((image) => {
                ctx.drawImage(image, 815, 315, 135, 127)
                ctx.fillText(Victim.Equipment.MainHand.Count, 917, 410)
            })
    }

    if (Victim.Equipment.OffHand) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.OffHand.Type + '.png?count=1&quality=' + Victim.Equipment.OffHand.Quality)
            .then((image) => {
                ctx.drawImage(image, 1070, 315, 135, 127)
                ctx.fillText(Victim.Equipment.OffHand.Count, 1173, 410)
            })
    }

    if (Victim.Equipment.Head) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Head.Type + '.png?count=1&quality=' + Victim.Equipment.Head.Quality)
            .then((image) => {
                ctx.drawImage(image, 940, 201, 135, 127)
                ctx.fillText(Victim.Equipment.Head.Count, 1042, 294)
            })
    }

    if (Victim.Equipment.Armor) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Armor.Type + '.png?count=1&quality=' + Victim.Equipment.Armor.Quality)
            .then((image) => {
                ctx.drawImage(image, 940, 316, 135, 127)
                ctx.fillText(Victim.Equipment.Armor.Count, 1042, 410)
            })
    }

    if (Victim.Equipment.Shoes) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Shoes.Type + '.png?count=1&quality=' + Victim.Equipment.Shoes.Quality)
            .then((image) => {
                ctx.drawImage(image, 940, 430, 135, 127)
                ctx.fillText(Victim.Equipment.Shoes.Count, 1042, 525)
            })
    }

    if (Victim.Equipment.Bag) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Bag.Type + '.png?count=1&quality=' + Victim.Equipment.Bag.Quality)
            .then((image) => {
                ctx.drawImage(image, 789, 191, 135, 127)
                ctx.fillText(Victim.Equipment.Bag.Count, 891, 287)
            })
    }

    if (Victim.Equipment.Cape) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Cape.Type + '.png?count=1&quality=' + Victim.Equipment.Cape.Quality)
            .then((image) => {
                ctx.drawImage(image, 1096, 191, 135, 127)
                ctx.fillText(Victim.Equipment.Cape.Count, 1198, 287)
            })
    }

    if (Victim.Equipment.Mount) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Mount.Type + '.png?count=1&quality=' + Victim.Equipment.Mount.Quality)
            .then((image) => {
                ctx.drawImage(image, 940, 543, 135, 127)
                ctx.fillText(Victim.Equipment.Mount.Count, 1042, 638)
            })
    }

    if (Victim.Equipment.Potion) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Potion.Type + '.png?count=1&quality=' + Victim.Equipment.Potion.Quality)
            .then((image) => {
                ctx.drawImage(image, 1096, 443, 135, 127)
                ctx.fillText(Victim.Equipment.Potion.Count, 1198, 538)
            })
    }

    if (Victim.Equipment.Food) {
        await Canvas.loadImage('https://render.albiononline.com/v1/item/' + Victim.Equipment.Food.Type + '.png?count=1&quality=' + Victim.Equipment.Food.Quality)
            .then((image) => {
                ctx.drawImage(image, 789, 443, 135, 127)
                ctx.fillText(Victim.Equipment.Food.Count, 891, 538)
            })
    }

    console.log('Draw info...')

    //Total Fame
    ctx.font = '24px Comic Sans MS'
    ctx.fillStyle = '#000000'
    ctx.textAlign = "center";
    ctx.fillText(TotalVictimKillFame.toLocaleString(), 640, 412)

    //Timestamp
    let getTime = TimeStamp.split('T')
    let date = getTime[0]
    let time = getTime[1].split('.')

    //Date
    ctx.fillText(date, 640, 486)

    //Time
    ctx.fillText(time[0], 640, 518)

    console.log('Gear ready!')

    const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'event.png')

    //Filtr victim inventory
    let victimEq = Victim.Inventory.filter((value) => {
        return value != null
    })

    console.log('Send Event')

    //Send Event
    const eventEmbed = new Discord.MessageEmbed()
        .setDescription('[' + Killer.Name + ' zabił ' + Victim.Name + '](' + 'https://albiononline.com/en/killboard/kill/' + EventId + ')')
        .setColor(color)
        .attachFiles(attachment)
        .setImage('attachment://event.png')
        .setFooter('KillBot created by CiufciaTomek#0289\n\n' + config.version + 'v');

    webhookClient.send({
        username: 'KillBOT',
        embeds: [eventEmbed],
    });


    //Send Inventory
    let eqLineSizeX = victimEq.length
    let eqLineSizeY = 1
    if (victimEq.length > 0) {
        console.log('Set inventory')
        if (victimEq.length > 9) {
            eqLineSizeX = 9
            eqLineSizeY = parseInt(victimEq.length / 10) + 1
        }
        const eqCanvas = Canvas.createCanvas((100 * eqLineSizeX), (100 * eqLineSizeY));
        const ctxEq = eqCanvas.getContext('2d');
        let dupa = 0
        let yAxis = 0
        let number = 1

        //Items image
        for (element of victimEq) {
            if (dupa == 10) {
                dupa = 0
                number = 1
            }
            ctxEq.font = '16px Comic Sans MS'
            ctxEq.fillStyle = '#ffffff'
            ctxEq.textAlign = "center";
            if (element != 0) {
                await Canvas.loadImage('https://render.albiononline.com/v1/item/' + element.Type + '.png?count=' + element.Count + '&quality=' + element.Quality).then((image) => {
                    ctxEq.drawImage(image, (90 * dupa), (1 * Math.floor((yAxis / 10)) * 100), 95, 95)
                    ctxEq.fillText(element.Count, ((18 * dupa) + 72 * number), ((Math.floor(yAxis / 10) * 100) + 75))
                })
            }
            dupa++
            yAxis++
            number++
        }

        console.log('Inventory ready!')

        const attachmentEq = new Discord.MessageAttachment(eqCanvas.toBuffer(), 'dupa.png')

        console.log('Send Inventory')

        //Send Inventory
        const inventoryEmbed = new Discord.MessageEmbed()
            .setDescription(Victim.Name + "'s Inventory")
            .setColor(color)
            .attachFiles(attachmentEq)
            .setImage('attachment://inventory.png');
        webhookClient.send({
            username: 'KillBOT',
            embeds: [inventoryEmbed],
        });

    }
    console.log('DONE!')
}

const saveLog = (data) => {
    fs.appendFile("./log/" + new Date().toISOString().split('T')[0] + ".txt", new Date().toISOString() + ' ' + data + '\n', function (e) {
        console.log("The file was saved!");
    });
}