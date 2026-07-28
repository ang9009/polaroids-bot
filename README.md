# polaroids

A photos/videos management suite consisting of a Discord bot that automatically uploads
media to my Synology FileStation, and a website that displays this media.

|             Bot commands             |          Website           |
| :----------------------------------: | :------------------------: |
| ![Bot commands](assets/commands.png) | ![Web](assets/website.png) |

## Setup

### Prerequisites

- Docker and Docker Compose installed on your machine.
- A Discord Developer Portal account.
- A Synology NAS with FileStation on it.

### Steps

1. Run `npm run setup` in the root directory

2. Create .env files in the root, bot, and backend directories

   The `.env` file in the `bot` directory should look like this:

   ```sh
   # From the Discord Developer Portal
   TOKEN=XXX
   CLIENT_ID=XXX
   GUILD_ID=XXX
   ```

   Your FileStation API url should be prefixed with "/webapi". Make sure
   that the user associated with your login details has admin permissions.
   More information about the FileStation API can be found [here](https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_File_Station_API_Guide.pdf).

   The `.env` file in the `backend` folder should look like this:

   ```sh
   # FileStation details
   FS_API_URL=XXXX
   FS_API_USERNAME=XXXX
   FS_API_PASSWORD=XXXX

   # The port for the API
   PORT=XXXX

   # Make sure that these variables match the .env file in the root folder.
   POSTGRES_USER=XXXX
   POSTGRES_PASSWORD=XXXX
   POSTGRES_DB=XXXX

   DATABASE_URL=XXXX
   ```

   The `.env` file in the root folder should look like this:

   ```sh
   POSTGRES_USER=XXXX
   POSTGRES_PASSWORD=XXXX
   POSTGRES_DB=XXXX
   ```

   These variables are used in `docker-compose.yml` to initialize the Postgres
   database.

3. Go to `constraints.sql` in the `backend` folder and run its contents in any
   database IDE/cli tool (e.g. psql)

## Starting Services

```bash
docker-compose build
docker-compose up
```

Refer to the docker compose file for port information. If you are running this
on a Mac with a Silicon chip, you may have to turn on "use Rosetta for x86/amd64
emulation on Apple Silicon" on Docker Desktop.

## Folder structure

There are three main directories: the `bot` directory, the `backend` directory, and the
`shared` directory.

- `bot` contains everything relevant to the polaroids Discord bot.
- `backend` contains everything relevant to the API that interacts with the
  Postgres database, which stores data about the bot's settings and the images
  it archives.
- `shared` contains error codes and response interfaces that are shared between
  the database API and the Discord bot.

### Adding events and commands

To add a new bot event, go to `bot/src/features`, select the associated
feature, navigate to its `events` folder and create a new file. Each event
must implement the `EventData` interface, and must be exported using a default
export. Otherwise, the `registerEvents` function will not be able to
find/register the event.

Adding a command is similar: there is a `commands` folder under each feature
folder. Create a new file in that folder, and in it, create a object that
implements the `CommandData` interface, then export it using a default export.
Otherwise, the `deploycommands` function will not be able to find/register the
command.

Note that errors thrown by events or commands are caught and logged by the bot
in `handleInteractions`, so throwing errors is fine.

Once you've added/changed a command, run the following while inside of the `bot`
folder to update the bot:

```
npm run deploycommands
```

### File storage

The discord attachment id is used as the file id. On FileStation, each file is
saved under the name "discordId.fileExtension". For example, if the file saved
is a .png image and the discordId is 1234, the name of the file on FileStation
would be 1234.png. Please keep this in mind when fetching media from
FileStation.
