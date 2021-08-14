// A program to turn on my air conditioner via a smart plug whenever
// the humidex (perceptual measure of temperature and humidity) is above
// a given threshold.

// for detailed setup instructions, see
// https://github.com/codetheweb/tuyapi
const TuyAPI = require('tuyapi')

const parseString = require('xml2js').parseString

const https = require('https');

// pass the configuration in via environment variables
const device = new TuyAPI({
  version: '3.3',
  issueRefreshOnConnect: true,
  ip: process.env.TUYAPLUGIP,
  id: process.env.TUYAPLUGID,
  key: process.env.TUYAPLUGKEY})

// Interval at which to poll for updates
const INTERVAL = 15*(60*1000) // ms

// Humidex level above which the air conditioner will run
const COMFORT_LEVEL = 25

// API endpoint, Montreal for me
// see https://eccc-msc.github.io/open-data/msc-data/citypage-weather/readme_citypageweather-datamart_en/
const WEATHER_URL = 'https://dd.weather.gc.ca/citypage_weather/xml/QC/s0000635_e.xml'

// Find device on network
device.find().then(() => {
  // Connect to device
  device.connect()
})

// Add event listeners
device.on('connected', () => {
  console.log('Connected to device!')
})

device.on('disconnected', () => {
  console.log('Disconnected from device.')
})

device.on('error', error => {
  console.log('Error!', error)
})

device.on('data', data => {
  console.log('Data from device:', data)
  //console.log(`Boolean status of default property: ${data.dps['1']}.`)
})

// t: temperature in Celcius, rh: relative humidity as percentage
function humidex (t, rh) {
	// http://irtfweb.ifa.hawaii.edu/~tcs3/tcs3/Misc/Dewpoint_Calculation_Humidity_Sensor_E.pdf
	const beta  = 17.62
	const lambda= 243.12 // ºC
	var h = Math.log(rh/100) + (beta*t)/(lambda+t)
	var dewpoint = lambda*h/(17.62-h) 
	// https://en.wikipedia.org/wiki/Humidex
	return t + (5/9)*(6.11*Math.exp(5417.7530*((1/273.15)-(1/(273.15+dewpoint))))-10)
}

// Every INTERVAL seconds, check the humidex. If it is above COMFORT_LEVEL,
// then turn the plug on (i.e. turn on the air conditioner)
function checkHumidex() {
	https.get(WEATHER_URL, (resp) => {
		let data = '';
		resp.on('data', (chunk) => {
			data += chunk
		})
		resp.on('end', () => {
			parseString(data, function(err, result) {
				let current = result.siteData.currentConditions
				// console.log(current)
				let temp = parseFloat(current[0].temperature[0]._)
				let rh   = parseFloat(current[0].relativeHumidity[0]._)
				let hx = humidex(temp, rh)
				console.log(new Date(), "T = ", temp, "RH = ", rh, "Hx = ", hx)

				// Turn the AC on or off
				if (hx > COMFORT_LEVEL) {
					console.log(new Date(), "setting A/C to ON, COMFORT_LEVEL is",  COMFORT_LEVEL)
					device.set({set: true})
				} else {
					console.log(new Date(), "setting A/C to OFF, COMFORT_LEVEL is", COMFORT_LEVEL)
					device.set({set: false})
				}

			})
		})
	})
}

checkHumidex()
setInterval(checkHumidex, INTERVAL)
