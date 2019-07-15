import {Command, Main, Parameters, Validate} from 'lib/bastion/command'
import {addRole, removeRole} from 'lib/bastion'

const tagExists = tag => !config.subscriptions[tag] && `Couldn't find tag with name ${tag}`

@Command("subscribe")
export class Subscribe {
  
  @Main()
  @Parameters(["tag"])
  @Validate([tagExists])
  async main({tag}, {user, userID}) {
    const id = config.subscriptions[tag]
    await addRole(userID, id)

    return `${user} subscribed to ${tag}`
  }

}

@Command("unsubscribe")
export class UnSubscribe {

  @Main()
  @Parameters(["tag"])
  @Validate([tagExists])
  async main({tag}, {user, userID}) {
    const id = config.subscriptions[tag]
    await removeRole(userID, id)

    return `${user} subscribed to ${tag}`
  }

}