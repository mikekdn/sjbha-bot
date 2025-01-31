import deepmerge from 'deepmerge'
import chalk from 'chalk'
import Ducks from './Duck'
import './schema'
import './shotSchema'
import moment from 'moment'
import Analyze from './Analyze'

const baseConfig = {
    channels: [
        "358442034790400001",
        "466328017342431233",
        "358442118928400384",
        "358527683337912320",
        "358916551744946177",
        "366820414820843522",
        "358921562658701322",
        "417871633768775693",
        "375143658128932864",
        "483859948850118678",
        "420997471741935617",
        "361192235146018826",
        "464301806533738496",
        "377347268430528522",
        "416525963464146944",
        "429459189824487463",
        "358921536071139330",
        "363123179696422916",
        "376901773656326144",
        "376901773656326144",
        "450913008323919872",
        "420136050065801227",
        "359573690033242119",
        "506911331257942027"
    ]
}

const SIX_HOURS = 1000 * 60 * 60 * 6
const EIGHTEEN_HOURS = 1000 * 60 * 60 * 12
const FIVE_MINUTES = 1000 * 60 * 5

let nextDuck = {
    start: 0,
    end: 0
}

let isActive = false
let activeTrack = {}

let timeout = null

const getSecondsMinutes = (shotTime) => {
    let time = shotTime / 1000
    time = Math.floor(time * 10) / 10

    if (time < 60) {
        return time + "s"
    }

    time = Math.floor(time / 60)
    return time + "m"
}

export default function(bastion, opt={}) {
    const config = deepmerge(baseConfig, opt)
    const q = new bastion.Queries("Duckhunt-s2")
    const qShot = new bastion.Queries("DuckhuntShot-s2")

    const an = Analyze(bastion)

    async function saveBang(user, userID) {
        let player = await q.findOne({ userID })
        if (!player) {
            q.create({
                user, userID,
                count: 1
            })
        } else {
            player.count++
            q.update({ userID }, player)
        }
    }

    function startTrack() {
        isActive = true
        activeTrack = {}

        for (var i = 0; i < config.channels.length; i++) {
            activeTrack[config.channels[i]] = 1
        }

        setTimeout(() => {
            sendDuck()
        }, FIVE_MINUTES)
    }

    bastion.on('message', (context) => {
        if (context.message.includes("🦆")) {
            const msg_id = context.evt.d.id
            
            bastion.bot.deleteMessage({
                channelID: context.channelID,
                messageID: msg_id
            })
            return;
        }

        if (!isActive) return;
        if (!activeTrack[context.channelID]) return;

        activeTrack[context.channelID]++
    })

    async function sendDuck() {
        console.log("activeTrack", activeTrack)
        let activeChannels = Object.entries(activeTrack)
            .map( ([k,v]) => ({ id: k, count: v }))
            .sort( (a,b) => {
                if (a.count > b.count) return -1
                if (a.count < b.count) return 1
                else return 0
            })
            .filter(n => n.count > 1)
            .slice(0, 3)

        console.log("ACTIVE CHANNELS", activeChannels)

        if (!activeChannels.length) {
            activeChannels = Object.entries(activeTrack).map( ([k,v]) => ({ id: k, count: v }))
        }

        isActive = false
        activeTrack = {}

        const i = Math.floor(Math.random()*activeChannels.length)
        const id = activeChannels[i].id

        const msg = await bastion.send(id, "\:duck:")
        Ducks.create(id, msg.id)
    }
    
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function startTimeout() {
        const time = getRandomInt(SIX_HOURS, EIGHTEEN_HOURS)
        const d = new Date().getTime()

        nextDuck = {
            start: new Date(d + SIX_HOURS),
            end: new Date(d + EIGHTEEN_HOURS)
        }

        if (timeout) {
            clearTimeout(timeout)
        }
        
        timeout = setTimeout(() => {
            startTrack()
        }, time)
    }

    Ducks.onDone(duck => {
        console.log("DONE", duck)
        const time = getSecondsMinutes(duck.shotTime)
        let msg = `\:dog: *duck shot by ${duck.shotBy.user} in ${time}* `

        if (duck.misses.length) {
            msg += ` \`[misses: ${duck.misses.map(n => n.user).join(",")}]\``
        }

        bastion.bot.editMessage({
            channelID: duck.channelID,
            messageID: duck.msgId,
            message: msg
        })
    })

    function formatTime(date) {
        date = new moment(date).tz("America/Los_Angeles").toDate()
        let hours = date.getHours()
        let ampm = (hours > 12) ? "pm" : "am"
        hours = (hours > 12) ? hours - 12 : hours
        hours = (hours === 0) ? 12 : hours
        let minutes = date.getMinutes()
        minutes = minutes < 10 ? "0" + minutes : minutes

        return `${hours}:${minutes}${ampm}`
    }

    function getSeason() {
        const d = new Date()

        if (d.getTime() < nextDuck.start) {
            return `Next season: ${formatTime(nextDuck.start)} - ${formatTime(nextDuck.end)} `
        } else {
            return `It's hunting season till ${formatTime(nextDuck.end)} ! `
        }
    }

    startTimeout()

    return [

        // {
        //     command: 'duck',

        //     resolve: async function(context, tag) {  
        //         const msg = await bastion.send(context.channelID, "\:duck:")
        //         Ducks.create(context.channelID, msg.id)
        //         // sendDuck()
        //     }
        // },

        {
            command: 'duckhunt',

            options: bastion.parsers.args(["tag"]),

            restrict: config.listRestrict,
            restrictMessage: `You can only get the duckhunt list in <#506911331257942027>`, 

            resolve: async function(context, tag) {  
                if (tag === "all") return this.route("all")

                return this.route("log")

                const user = await q.findOne({ userID: context.userID })
                if (!user) return `You haven't shot any ducks, keep looking!`

                return `Count: **${user.count}**`
            }
        },

        {
            action: 'duckhunt:all',

            resolve: async function(context, tag) {  
                const counter = function(val) {
                    if (val < 10) return ' ' + val
                    else return val
                }

                const padScore = val => {
                    if (val < 10) return '  ' + val
                    if (val < 100) return ' ' + val
                    return val
                }

                const players = await q.getAll()
                const playerScores = players.map(n => {
                    n.score = n.count*10 + n.misses*5
                    return n
                })
                console.log(playerScores)
                const msg = playerScores
                    .sort( (a, b) => {
                        return a.score > b.score ? -1 : 1;
                        if (a.count > b.count) {
                            return -1
                        } else if (a.count < b.count) {
                            return 1
                        } else {
                            if (a.misses > b.misses) {
                                return -1
                            } else {
                                return 1
                            }
                        }
                    }).map( p => {
                        return `${padScore(p.score)} [${counter(p.count)}-${p.misses}] ${p.user}`
                    }).join("\n")
                return `[season 2]\n` + getSeason() + bastion.helpers.code(msg, "ini")
            }
        },

        {
            action: 'duckhunt:log',

            resolve: async function(context, tag) {  
                const shots = await qShot.Schema
                    .find()
                    .sort('-timestamp')
                    .limit(5)
                    .exec()

                let msg = shots.map( n => {
                    let msg = `${formatTime(n.timestamp)} by ${n.shotBy.user} in <#${n.channelID}>`
                    for (var i = 0; i < n.misses.length; i++) {
                        msg += `\n    > miss: ${n.misses[i].user}`
                    }
                    return msg
                }).join("\n")

                msg = bastion.bot.fixMessage(msg)

                return `[season 2]\n` + getSeason() + bastion.helpers.code(msg)
            }
        },

        {
            command: "bang",

            resolve: async function(context, tag) {
                const msg_id = context.evt.d.id

                await bastion.bot.deleteMessage({
                    channelID: context.channelID,
                    messageID: msg_id
                })

                const duck = Ducks.bang(bastion, context.channelID, context.userID, context.user)
                if (!duck) return;

                let msg = `🦆💥${duck.misses.map(n => `💥`)}`

                await bastion.bot.editMessage({
                    channelID: context.channelID,
                    messageID: duck.msgId,
                    message: msg
                })

                if (duck.newShot) {
                    saveBang(context.user, context.userID)
                }

                startTimeout()
            },

            methods: {
                getSecondsMinutes(shotTime) {
                    let time = shotTime / 1000
                    time = Math.floor(time * 10) / 10
    
                    if (time < 60) {
                        return time + "s"
                    }

                    time = Math.floor(time / 60)
                    return time + "m"
                }
            }
        }

    ]
}