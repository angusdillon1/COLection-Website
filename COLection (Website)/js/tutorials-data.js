/* The video guides on the Help page. This is the only file you need to edit to add a video.

   Each entry is one card. An entry with no video yet shows as "Coming soon". To publish one, add ONE of these lines to it:

     youtube: "dQw4w9WgXcQ"                  the code after v= in a YouTube link (upload it as "Unlisted" if you don't want it searchable)
     vimeo:   "123456789"                    the number in a Vimeo link
     file:    "videos/first-election.mp4"    a video file you put in the videos folder (keep it under about 90 MB for free hosting)

   Optional on any entry:
     length:   "6 min"
     level:    "Start here"
     poster:   "videos/first-election.jpg"   a picture shown before a video file is played
     captions: "videos/first-election.vtt"   subtitles for a video file (YouTube and Vimeo have their own captions)

   Move an entry up or down to change the order. Save, and refresh the Help page. */
window.COL_TUTORIALS = [
  { title: "Your first election, start to finish", about: "Set the rules, add the people, vote, count and export the report, all in one go.", level: "Start here" },
  { title: "Setting the rules", about: "Positions, groups and limits, tie rules, minimum turnout, and starting from a template." },
  { title: "Voting stations and phones", about: "Hosting the vote, joining stations, the QR code for phones, sending voters, and taking a ballot back." },
  { title: "Big groups: registering voters at the desk", about: "Run a vote with no voter list: register people as they arrive, check ID at the station, and measure turnout." },
  { title: "Checking and counting", about: "The Check step, settling ties, reading the results, counting again and signing off." },
  { title: "Reports and exporting", about: "Choose what goes in the printed report, preview the PDF, and save, print or sign it." },
  { title: "If the host computer fails", about: "How a second computer takes over from a backup, so no vote is lost." },
  { title: "Licences", about: "Entering, copying and removing a licence, and what happens when one ends." }
];
