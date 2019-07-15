import {Command, Main, Parameters, Restrict} from 'lib/bastion/command'
import {simulateTyping, uploadFile, sendMessage} from 'lib/bastion'
import download from 'image-downloader'

@Command("chart")
@Restrict("stocks")
export class Chart {
  
  @Main()
  @Parameters(["symbol", "chartStyle"])
  async main({symbol, chartStyle}, {channelID}) {
    const style = chartStyle === "line" ? "l" : "c"

    const options = {
      url: `https://finviz.com/chart.ashx?t=${symbol}&ty=${style}&ta=0&p=d&s=l`,
      dest: `${__dirname}/chart.png`      
    }

    simulateTyping(channelID)

    try {
      await download.image(options)
      uploadFile({
        to: channelID,
        file: options.dest
      })
    } catch(err) {
      sendMessage(channelID, "Something went wrong trying to get the chart")
    }
  }

}