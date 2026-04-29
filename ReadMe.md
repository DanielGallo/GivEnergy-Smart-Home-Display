# GivEnergy Dashboard

![](graphics/ReadMe-1.jpg)

## Introduction

This is a web-based application for showing a live summary of energy data from one or more GivEnergy inverters.

Data can be summarised if you are using a single inverter, or multiple inverters on a single phase, or multiple inverters
in a 3-phase environment.

It is designed to fetch its data from [GivTCP](https://github.com/britkat1980/giv_tcp), and is bundled within
recent versions of GivTCP.

## User interface

![Landscape example](graphics/ReadMe-Landscape.png)

The user interface of the web app is rendered completely using SVG. The only external dependencies for the user interface
are a little use of jQuery. The rest of the app consists of pure JavaScript and CSS.

Data is obtained from the inverter by using REST requests to GivTCP on the local network.

The web app can run on a mobile, tablet, or desktop browser, and is designed to run in both portrait and landscape modes. 
It should render correctly on all devices/browsers. Let me know if you spot any rendering issues!

<img src="graphics/ReadMe-Portrait.png" width="400" alt="Portrait example">

## Setup

This web app is bundled with recent versions of [GivTCP](https://github.com/britkat1980/giv_tcp).

1. Follow the installation instructions for [GivTCP](https://github.com/GivEnergy/giv_tcp) and set this up somewhere on 
   your local network so that it's running 24/7. This runs inside a Docker container.
2. When you configure GivTCP, you will need to set a few GivTCP parameters in the Docker Compose file in order to
   use this web app:
    1. `WEB_DASH` - set to `True` to enable this web dashboard.
    2. `WEB_DASH_PORT` - set it to the default port `3000`.
3. If you have multiple inverters and want the name of each inverter to be shown in the web app, you will also need to set 
   the following parameters:
    1. `INVERTOR_NAME_1` - a short friendly display name for the first inverter.
    2. `INVERTOR_NAME_2` - a short friendly display name for the second inverter, etc.

## Usage

The web app is accessed from the same network address as GivTCP, and will run on port 3000 by default. So you should be
able to launch the web app via `http://10.0.0.210:3000` (assumes `10.0.0.210` is the host where GivTCP is running).

You can append additional query-string parameters to show more advanced information:

- `ShowAdvancedInfo=true` - this will show/hide advanced information for each inverter, including individual battery state of charge.
  Defaults to `true`.
- `ShowTime=true` - will show/hide the current time in the top-left corner of the app - useful if you want to use this fullscreen
  on a tablet or mobile device.
  Defaults to `false`.
- `Hostname=` - this will let you override the hostname for GivTCP. Useful if you want to render this web app from a 
  different host than GivTCP. Defaults to using the same hostname as used in the browser.
- `LightMode=true` - switches the app to a light theme with a white background and dark text.
  Defaults to `false` (dark mode).

For example, you can append these query-string parameters like this:

```
http://10.0.0.210:3000?ShowAdvancedInfo=true&ShowTime=true&Hostname=homeassistant.local
```

## Testing a downloaded copy against your GivTCP environment

This section explains how to test the latest version of the dashboard against your own live GivTCP setup, before the latest code is released as part of the main GivTCP project.

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
- **`solarRate`** - your solar generation/import rate in £/kWh.
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
http://localhost:8080?Hostname=192.168.1.100
```

Replace `192.168.1.100` with the IP address of the machine running GivTCP on your home network (this is the same address you would normally use to access your GivTCP dashboard, without the port number).

The dashboard should load and start showing live data within a few seconds.

### Troubleshooting

**The dashboard loads but shows no data**

Check that you used the correct IP address in the URL above (`?Hostname=`). To confirm GivTCP is reachable, try opening `http://192.168.1.100:6345/readData` in your browser (replacing the IP with yours). You should see a page of data rather than an error.

**The browser is blocking the connection (CORS error)**

If you open the browser console (press F12, then click the Console tab) and see an error mentioning `CORS` or `Cross-Origin`, your browser is blocking the connection between the local web server and GivTCP. The simplest fix is to open the dashboard from a different device on the same network, such as your phone, and point it at your computer's IP address instead of `localhost`.

## Other Notes

- SVG icons were designed and generated using https://yqnn.github.io/svg-path-editor/