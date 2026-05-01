# GivEnergy Web Dashboard

![](graphics/ReadMe-1.jpg)

## Introduction

This is a web-based application for showing a live summary of energy data from one or more GivEnergy inverters.

Data can be summarised if you are using a single inverter, multiple inverters on a single phase, or multiple inverters
in a 3-phase environment. The app should be able to summarise data from GivEnergy AC inverters, Hybrid inverters, All In One (AIO) systems,
Gateways, Energy Management System (EMS - _implementation in progress_), and the GivEnergy EV Charger (EVC).

It is designed to fetch its data from [GivTCP](https://github.com/britkat1980/giv_tcp) on the local network, and is bundled within recent versions of GivTCP.

Note: The app doesn't provide a way to change configuration options for inverters - it only shows a summary of the inverter, 
power flows, and energy usage. It can be embedded in a Home Assistant dashboard view, or added as a shortcut to your phone's home screen
for quickly checking the state of your GivEnergy system and energy usage.

## User interface

![Landscape example](graphics/ReadMe-Landscape.png)

The web app can run on a mobile, tablet, or desktop browser, and is designed to run in both portrait and landscape modes. 
It should render correctly on all devices/browsers. Let me know if you spot any rendering issues!

<img src="graphics/ReadMe-Portrait.png" width="400" alt="Portrait example">

## Setup and usage

This web app is bundled with recent versions of [GivTCP](https://github.com/britkat1980/giv_tcp). 

GivTCP is usually installed by users in Home Assistant. Once GivTCP is installed, the web dashboard can be enabled via the GivTCP
config (the Web tab), and usually runs on port 3000 by default, e.g. `http://homeassistant.local:3000`.

You can append additional query-string parameters to show more advanced information:

- `ShowAdvancedInfo=true` - show or hide the advanced information panel for each inverter - when shown, includes solar power per inverter and 
  individual battery state of charge.
  Defaults to `true` (shows the advanced info panel).
- `ShowTime=true` - show or hide the current time in the top-left corner of the app - useful if you want to use this app fullscreen
  on a tablet or mobile device.
  Defaults to `false` (hides the time).
- `ShowSolar=false` - hide all solar-related elements, including the solar circle, power flow lines to and from solar, and the solar
  generation summary. Useful for GivEnergy systems that do not have solar panels installed.
  Defaults to `true` (shows solar).
- `LightMode=true` - switches the app to a light theme with a white background and dark text.
  Defaults to `false` (uses dark mode).
- `Hostname=` - this will let you override the hostname or IP address for GivTCP. Useful if you want to render this web app from a
  different host than GivTCP. Defaults to using the same hostname as used in the browser.
- `CurrencySymbol=` - override the currency symbol used throughout the app. Accepts 1 or 2 characters.
  Defaults to `£`. Example: `CurrencySymbol=$`.

For example, you can append query-string parameters like this:

```
http://homeassistant.local:3000?ShowTime=true&LightMode=true
```

## Adding to a Home Assistant Dashboard

The web dashboard can be embedded directly into a Home Assistant dashboard using the built-in **Webpage** card.

### Using the visual editor

1. Open your Home Assistant dashboard and click the **pencil icon** to enter edit mode.
2. Click **Add Card**, then search for and select **Webpage**.
3. Enter the URL of the dashboard, e.g.
   ```
   http://homeassistant.local:3000
   ```
   You can append query-string parameters here too, for example:
   ```
   http://homeassistant.local:3000?ShowTime=true&LightMode=true
   ```
4. Set an appropriate **Aspect ratio** (e.g. `18:9` for landscape, `3:5` for portrait).
5. Click **Save**.

### Using YAML

Switch the card editor to YAML mode and use the following configuration:

```yaml
type: iframe
url: http://homeassistant.local:3000
aspect_ratio: "18:9"
```

## Testing a downloaded copy against your GivTCP environment

This section explains how to test the latest version of the web dashboard against your own live GivTCP setup, before the latest code is released as part of the main GivTCP project.

Your GivTCP instance needs to be running and reachable on your home network before you begin.

### Step 1 - Download the code

Click the green **Code** button near the top of this GitHub page, then choose **Download ZIP**. Once downloaded, extract the ZIP to a folder on your computer.

### Step 2 - Copy your settings into app.json

Open the `app.json` file (in the root of the extracted folder) in a text editor. It looks something like this:

```json
{
  "givTcpHosts": [
    { 
      "name": "House", 
      "port": "6345"
    }, {
      "name": "Garage",
      "port": "6346"
    }
  ],
  "solarRate": 0.306,
  "exportRate": 0.15
}
```

The easiest way to get the correct values is to open your existing GivTCP dashboard's `app.json` in a browser. If GivTCP is running in Home Assistant, go to:

```
http://homeassistant.local:3000/app.json
```

Copy the entire contents and paste them into the `app.json` file you opened in Step 2, replacing everything that was already there. Save the file.

Here is what each property means, for reference:

- **`givTcpHosts`** - one entry per inverter, each with a display name and the port GivTCP uses for that inverter. The default port is `6345`.
- **`solarRate`** - typically your peak import rate in £/kWh, used to calculate the equivalent cost of importing all generated solar energy during the day. 
  Essentially, it represents how much that energy would have cost if drawn from the grid.
- **`exportRate`** - your export rate in £/kWh.

### Step 3 - Start a simple web server

The dashboard has to be served over a local web server. Opening `index.html` directly from your file browser will not work.

The easiest way is to use Python, which comes pre-installed on Mac and most Linux systems. Windows users can download it for free from [python.org](https://www.python.org/downloads/).

Open a terminal (or Command Prompt on Windows), navigate to the folder you extracted in Step 1, and run:

```bash
python3 -m http.server 8080
```

Leave this running in the background. You should see a message like `Serving HTTP on 0.0.0.0 port 8080`.

### Step 4 - Open the dashboard in your browser

Open your browser and go to:

```
http://localhost:8080?Hostname=homeassistant.local
```

Replace `homeassistant.local` with the hostname or IP address of the machine running GivTCP on your home network (this is the same address you would normally use to access your GivTCP dashboard, without the port number).

The dashboard should load and start showing live data within a few seconds.

### Troubleshooting

**The dashboard loads but shows no data**

Check that you used the correct IP address in the URL above (`?Hostname=`). To confirm GivTCP is reachable, try opening `http://homeassistant.local:6345/readData` in your browser (replacing the hostname if necessary). You should see a page of data rather than an error.

**The browser is blocking the connection (CORS error)**

If you open the browser console (press F12, then click the Console tab) and see an error mentioning `CORS` or `Cross-Origin`, your browser is blocking the connection between the local web server and GivTCP. The simplest fix is to open the dashboard from a different device on the same network, such as your phone, and point it at your computer's IP address instead of `localhost`.

## Other Notes

- SVG icons were designed and generated using https://yqnn.github.io/svg-path-editor/
- The user interface of the web app is rendered completely using SVG. The only external dependencies for the user interface are a little use of jQuery. The rest of the app consists of pure JavaScript and CSS.