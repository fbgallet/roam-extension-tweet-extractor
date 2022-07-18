var header = " | Text:\n"; // format text before tweet content

if (window.roamjs.extension.smartblocks) {
  registerCommand();
  console.log("command loaded!");
} else {
  document.body.addEventListener("roamjs:smartblocks:loaded", () =>
    registerCommand()
  );
  console.log("command loaded after Sb!");
}

function registerCommand() {
  window.roamjs.extension.smartblocks.registerCommand({
    text: "TWEETEXTRACTOR",
    handler: (context) => async (text) =>
      [await tweetExtractor(context.targetUid, text)],
  });
}

// Load jQuery if Roam42 is not installed.
// You can desactivate (with /* */) the next 13 lines if you have Roam42 installed
var existing = document.getElementById("jQuery-script");
if (!existing) {
  setTimeout(function () {
    const script = document.createElement("script");
    script.src =
      "https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js";
    script.id = "jQuery-script";
    script.async = true;
    script.type = "text/javascript";
    script.addEventListener("load", () => {
      console.log(`jQuery ${$.fn.jquery} has been loaded successfully!`);
    });
    document.getElementsByTagName("head")[0].appendChild(script);
  }, 250);
}
// End of jQuery / Roam42 test

const regex =
  /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/;
var urlRegex = new RegExp(regex, "ig");

function addButton(caption) {
  return (
    " {{" + caption + ":SmartBlock:Tweet Archiver & Extractor:text=button}}"
  );
}

function moveToChildBlock(content, uid, text) {
  let childUid = window.roamAlphaAPI.util.generateUID();
  if (text == "button2") {
    content += addButton(buttonCaption);
  }
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": uid, order: 0 },
    block: { string: content, uid: childUid },
  });
  return childUid;
}

function linkify(text) {
  return text.match(urlRegex);
}

function getTweetUserName(url) {
  let stringArray = url.split("/", 4);
  if (stringArray.length > 3) {
    return stringArray[3];
  } else {
    return "**Error with tweet URL**";
  }
}

function FormatUserName(nameR, nameP, prefix) {
  let names = "[[" + prefix + nameR + "]] " + "(" + nameP + ")";
  return names;
}

function PrintTitle(names, k, alias, refP, refC) {
  var title = "#tweet by " + names;
  if (k) {
    title += " [" + alias + "](((" + refC + ")))";
  }
  window.roamAlphaAPI.updateBlock({
    block: { uid: refP, string: "", open: false },
  });
  return title;
}

function getAuthorName(authorName) {
  let authorNameTab = authorName.split(" ");
  authorName = authorNameTab[0];
  let index = 1;
  while (
    index < authorNameTab.length &&
    !/\W+/.test(authorNameTab[index].charAt(0))
  ) {
    authorName += " " + authorNameTab[index];
    index++;
  }
  return authorName;
}

function getTextFromTweet(htmlString) {
  let stripedHtml = htmlString.replace(/<br[^>]*>/gi, "\n");
  stripedHtml = stripedHtml.replace(/<[^>]+>/g, "");
  //  stripedHtml = stripedHtml.replace(/&quot;|&#39;|&mdash;/g,' ');
  stripedHtml = stripedHtml.replace(/&quot;/g, '"');
  stripedHtml = stripedHtml.replace(/&#39;/g, "'");
  stripedHtml = stripedHtml.replace(/&mdash;/g, "—");
  let splitS = stripedHtml.split("—");
  stripedHtml = splitS[0];
  for (let i = 1; i < splitS.length - 1; i++) {
    stripedHtml = "—" + splitS[i];
  }
  return header + stripedHtml;
}

function getTweetUrl(content) {
  let urlsTab = linkify(content);
  if (urlsTab != null) {
    return urlsTab[urlsTab.length - 1];
  } else {
    return 0;
  }
}

function getBlockContent(uid) {
  let q = `[:find (pull ?page [:block/uid :block/string ])
                    :where [?page :block/uid "${uid}"] ]`;
  let blockTree = window.roamAlphaAPI.q(q);
  return blockTree[0][0].string;
}

function getFirstChildrenContent(uid) {
  let q = `[:find (pull ?page
                       [:block/uid :block/string :block/children 
						{:block/children ...} ])
                    :where [?page :block/uid "${uid}"]  ]`;
  let blockTree = window.roamAlphaAPI.q(q);
  if (!blockTree[0][0].children) {
    return "no children";
  }
  return blockTree[0][0].children[0].string;
}

async function tweetExtractor(startUID, text) {
  /************************ USER SETTINGS ************************/

  let publicNameAsRef = false; // true: by [[Full public Name]] (@username), false: [[@username]] (Full public Name)
  let prefixName = "@"; // "" for no change,  "@" for Ref like [[@username]] or [[@Author Name]],
  // (@username), when not used as reference, has always @ prefix
  let withAlias = true; // if false, no alias to tweet block-ref is added
  let formatAlias = "👁‍🗨"; // icon to click for sneak peek

  let extractDefault = "button1"; // set to "content" if you want insert the content from tweet in parent block
  // set to "button1" if you want insert the extract text button in parent block
  let buttonCaption = "📑";

  /***************************************************************/

  let output = "output";
  let tweetText = "";
  if (text == "default") {
    text = extractDefault;
  }

  let startingBlockUID = startUID; // .slice(2,-2);
  let blockContent = getBlockContent(startingBlockUID).trim();

  if (blockContent == "") {
    blockContent = await navigator.clipboard.readText();
  }
  let urlTweet = getTweetUrl(blockContent);
  blockContent = urlTweet;
  if (urlTweet == 0) {
    urlTweet = getFirstChildrenContent(startingBlockUID);
    urlTweet = getTweetUrl(urlTweet);
    if (urlTweet == 0) {
      return;
    }
  }
  let userName, uid;

  if (text != "button") {
    userName = getTweetUserName(urlTweet);
    uid = moveToChildBlock(blockContent, startingBlockUID, text);
  }

  /* Get Public Name with oembed JQuerie from Twitter API */
  let r = await $.ajax({
    url: "https://publish.twitter.com/oembed?omit_script=1&url=" + urlTweet,
    //url: "https://publish.twitter.com/oembed?omit_script=1&limit=20&url="
    dataType: "jsonp",
    success: function (data) {
      console.log("Tweet json data:");
      console.log(data);
      if (text != "button") {
        let authorName = getAuthorName(data.author_name);
        if (publicNameAsRef) {
          output = PrintTitle(
            FormatUserName(authorName, "@" + userName, prefixName),
            withAlias,
            formatAlias,
            startingBlockUID,
            uid
          );
        } else {
          output = PrintTitle(
            FormatUserName(userName, authorName, prefixName),
            withAlias,
            formatAlias,
            startingBlockUID,
            uid
          );
        }
      }
      if (text == "content" || text == "button") {
        tweetText = getTextFromTweet(data.html);
      } else if (text == "button1") {
        tweetText = addButton(buttonCaption);
      }
    },
  });

  return output + tweetText;
}
