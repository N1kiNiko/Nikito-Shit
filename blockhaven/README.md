# Blockhaven

An original Minecraft-inspired creative block sandbox. No Minecraft assets or external libraries. LAN melee PvP included. Includes a self-contained HTML game and an optional LAN host.

## Solo

Open `index.html` in a current Chrome, Edge, Firefox, or Safari browser. WebGL is required. Solo block changes save in that browser when local storage is available. This is a finite 32 × 32 × 24 world with creative flight, not a full Minecraft clone.

## Play together on Wi-Fi

1. Extract the ZIP on one computer and install Node.js 18 or newer if needed.
2. In that folder, run `node server.js`.
3. Open the printed `http://192.168.…:8080` (or other printed LAN address) on every device, including the host. Keep the terminal open.
4. Allow Node.js through the computer's firewall for the private network if prompted. All devices must use the same host address on the same LAN; guest Wi-Fi/client isolation may block connections.

Everyone automatically joins the same world: see other explorers, mine/place shared blocks, and chat. No npm install, account, external service, or Internet connection is needed. The host supports up to 24 connected pages. The shared world is in memory and resets when the server stops. Reconnecting replaces your view with the host's current world; solo edits do not upload into the LAN world.

**An HTML file alone cannot automatically discover other devices on Wi-Fi.** You must open the LAN server URL, rather than separate copies of the file, to play together. The server is intended for a trusted local network, with no authentication; do not expose it to the public Internet.

## Controls

- WASD: move. Mouse: look. Click the world to capture the mouse; Esc pauses.
- Space: fly up. Shift: fly down. Movement collides with blocks.
- Left click: hit an aimed player within 3.5 blocks, or mine a block. Right click: place the selected block. Range: seven blocks.
- 1–7, mouse wheel, or hotbar: choose Grass, Dirt, Stone, Wood, Leaves, Sand, or Brick.
- T: LAN chat. Enter sends; Esc cancels.
- Touch: drag the world to look, use the direction and altitude buttons, then tap Mine or Build. Rotate your phone to landscape for more room.

Blocks outside the map and mining the bottom layer are restricted. LAN PvP gives each explorer 20 health. Melee hits deal 4 damage, with a 450 ms cooldown. Five hits defeat an explorer, who immediately respawns at a random safe spot with full health and two seconds of protection. Blocks stop attacks; health and hit checks are handled by the host. There are no mobs, crafting, survival hunger, or infinite terrain.

## Hosting options

Set `PORT` to change the default port (8080). Serve `index.html` alone from any static host for solo play. Shared LAN play requires `server.js`; a static HTML preview does not host the multiplayer server.
