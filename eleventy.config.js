const fs = require("node:fs");
const path = require("node:path");
const { DateTime } = require("luxon");
const { URL } = require("url");
const numeral = require("numeral");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItToc = require("markdown-it-table-of-contents");
const { encode } = require("html-entities");
const { YoutubeTranscript } = require("youtube-transcript");
const { AssetCache } = require("@11ty/eleventy-fetch");

const { feedPlugin } = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginWebc = require("@11ty/eleventy-plugin-webc");

const siteData = require("./_data/site.json");
const pluginImage = require("./_11ty/imagePlugin.js");
const { imageShortcode, opengraphImageHtml, screenshotImageHtmlFullUrl } = pluginImage;

const pluginSass = require("./_11ty/sassPlugin.js");

const pluginNavigation = require("@11ty/eleventy-navigation");

// const pluginImageAvatar = require("./_11ty/imageAvatarPlugin.js");
// const pluginAnalytics = require("./_11ty/analyticsPlugin.js");

const JS_ENABLED = true;

module.exports = async function(eleventyConfig) {
  // TODO move this back out after this config file is ESM
  const { RenderPlugin } = await import("@11ty/eleventy");

  eleventyConfig.addGlobalData("JS_ENABLED", () => JS_ENABLED);

  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

  // More in .eleventyignore
  if(!process.env.PRODUCTION_BUILD) {
    eleventyConfig.ignores.add("./follow/*");
    eleventyConfig.ignores.add("./web/opengraph-images.liquid");
  }

  eleventyConfig.setUseGitIgnore(false);
  eleventyConfig.setDataDeepMerge(true);
  eleventyConfig.setQuietMode(true);

  eleventyConfig.setLiquidOptions({
    jsTruthy: true
  });

  eleventyConfig.setServerOptions({
    domDiff: false,
    showVersion: true,
  });

  /* PLUGINS */
  eleventyConfig.addPlugin(pluginSass);
  eleventyConfig.addPlugin(pluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginImage);
  eleventyConfig.addPlugin(pluginNavigation);
  // eleventyConfig.addPlugin(pluginImageAvatar);

  if(process.env.PRODUCTION_BUILD) {
    eleventyConfig.addPlugin(feedPlugin, {
      outputPath: "/web/feed/atom.xml",
      collection: {
        name: "feedPosts",
        limit: 10,
      },
      metadata: {
        language: "en",
        title: siteData.name,
        subtitle: siteData.description,
        base: siteData.url,
        author: {
          name: siteData.name,
        }
      }
    });
  }
  eleventyConfig.addPlugin(pluginWebc, {
    components: [
      "_components/**/*.webc",
      "npm:@11ty/eleventy-plugin-syntaxhighlight/*.webc",
    ],
  });

  eleventyConfig.addPlugin(RenderPlugin, {
    accessGlobalData: true,
  });
  // eleventyConfig.addPlugin(pluginAnalytics);

  /* COPY */
  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

  eleventyConfig
    .addPassthroughCopy({
      // WebC assets
      "_components/*.{css,js}": `static/`,

      // CSS/JS
      "static/fonts": "static/fonts",
      "static/js": "static/js",
      "static/*.{css,js}": "static/",

      // External modules
      "node_modules/@zachleat/details-utils/details-utils.js": `static/details-utils.js`,
      "node_modules/speedlify-score/speedlify-score.{css,js}": `static/`,
      "node_modules/lite-youtube-embed/src/lite-yt-embed.{css,js}": `static/`,
      "node_modules/artificial-chart/artificial-chart.{css,js}": `static/`,
      "node_modules/@zachleat/table-saw/table-saw.js": `static/table-saw.js`,
      "node_modules/@zachleat/pagefind-search/pagefind-search.js": `static/pagefind-search.js`,
    })
    .addPassthroughCopy("humans.txt")
    .addPassthroughCopy("resume/index.css")
    .addPassthroughCopy("img/")
    .addPassthroughCopy("web/img")
    .addPassthroughCopy("web/wp-content")
    .addPassthroughCopy("og/*.{jpeg,png}")
    .addPassthroughCopy("og/sources/")
    .addPassthroughCopy("presentations/");

  // Production only passthrough copy
  if(process.env.PRODUCTION_BUILD) {
    eleventyConfig
      .addPassthroughCopy("keybase.txt")
      .addPassthroughCopy("_redirects")
      .addPassthroughCopy("resume/resume.pdf");
  }

  /* LAYOUTS */
  eleventyConfig.addLayoutAlias("default", "layouts/default.liquid");
  eleventyConfig.addLayoutAlias("post", "layouts/post.liquid");

  /* FILTERS */

  eleventyConfig.addFilter("tweetbackUrl", async (url) => {
    const { transform } = await import("@tweetback/canonical");
    return transform(url);
  });

  eleventyConfig.addFilter("archiveUrl", (url, targetYear) => {
    if(!targetYear) {
      targetYear = (new Date).getFullYear();
    }
    return `https://web.archive.org/web/20230000000000*/${url}`;
  });

  function leftpad(str, length = 3) {
    let padding = Array.from({length}).map(t => "0").join("");
    return (padding + str).substring((""+str).length);
  }
  eleventyConfig.addFilter("leftpad", leftpad);

  eleventyConfig.addFilter("truncate", (str, len = 280) => { // tweet sized default
    let suffix = str.length > len ? `… <span class="tag-inline">Truncated</span>` : "";
    return str.substr(0, len) + suffix;
  });

  eleventyConfig.addFilter("selectRandomFromArray", (arr) => {
    let index = Math.floor(Math.random() * arr.length);
    return arr[index];
  });

  eleventyConfig.addLiquidFilter("numberString", function(num) {
    let strs = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    if( num < strs.length ) {
      return strs[num];
    }
    return num;
  });

  eleventyConfig.addLiquidFilter("renderNumber", function renderNumber(num) {
    return numeral(parseInt(num, 10)).format("0,0");
  });

  eleventyConfig.addLiquidFilter("round", function(num, digits = 2) {
    return parseFloat(num).toFixed(digits);
  });

  eleventyConfig.addLiquidFilter("medialengthCleanup", str => {
    let split = str.split(" ");
    return `${split[0]}<span aria-hidden="true">m</span><span class="sr-only"> minutes</span>`;
  });

  eleventyConfig.addLiquidFilter("encodeUriComponent", str => {
    return encodeURIComponent(str);
  });

  eleventyConfig.addLiquidFilter("htmlEntities", str => {
    return encode(str);
  });

  eleventyConfig.addLiquidFilter("absoluteUrl", (url, base) => {
    if( !base ) {
      base = siteData.url;
    }
    try {
      return (new URL(url, base)).toString();
      } catch(e) {
      console.log(`Trying to convert ${url} to be an absolute url with base ${base} and failed.`);
      return url;
    }
  });

  eleventyConfig.addFilter("timePosted", (startDate, endDate = Date.now()) => {
    if(typeof startDate === "string") {
      startDate = Date.parse(startDate);
    }
    if(typeof endDate === "string") {
      endDate = Date.parse(endDate);
    }
    let numDays = ((endDate - startDate) / (1000 * 60 * 60 * 24));
    let prefix = "";
    if(numDays < 0) {
      prefix = "in ";
      numDays = Math.abs(numDays);
    }

    let daysPosted = Math.round( parseFloat( numDays ) );
    let yearsPosted = parseFloat( (numDays / 365).toFixed(1) );

    if( daysPosted < 365 ) {
      return prefix + daysPosted + " day" + (daysPosted !== 1 ? "s" : "");
    } else {
      return prefix + yearsPosted + " year" + (yearsPosted !== 1 ? "s" : "");
    }
  });

  eleventyConfig.addNunjucksFilter("rssNewestUpdatedDate", collection => {
    if( !collection || !collection.length ) {
      throw new Error( "Collection is empty in lastUpdatedDate filter." );
    }

    return DateTime.fromJSDate(collection[ 0 ].date).toISO({ includeOffset: true, suppressMilliseconds: true });
  });

  eleventyConfig.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj).toFormat("LLLL dd, yyyy");
  });

  eleventyConfig.addLiquidFilter("readableDateFromISO", (dateStr, formatStr = "dd LLL yyyy 'at' hh:mma") => {
    return DateTime.fromISO(dateStr).toFormat(formatStr);
  });

  eleventyConfig.addLiquidFilter("twitterUsernameFromUrl", (url) => {
    if( url.indexOf("https://twitter.com/") > -1 ) {
      return "@" + url.replace("https://twitter.com/", "");
    }
  });

  eleventyConfig.addLiquidFilter("getPostCountForYear", (posts, year) => {
    return posts.filter(function(post) {
      return post.data.page.date.getFullYear() === parseInt(year, 10);
    }).length;
  });

  //<img src="https://v1.sparkline.11ty.dev/400/100/1,4,10,3,2,40,5,6,20,40,5,1,10,100,5,90/red/" width="400" height="100">
  eleventyConfig.addLiquidFilter("getYearlyPostCount", (posts, startYear = 2007) => {
    let years = [];
    for(let j = startYear; j <= (new Date()).getFullYear(); j++) {
      let year = j;
      let count = posts.filter(function(post) {
        return post.data.page.date.getFullYear() === parseInt(year, 10);
      }).length;
      years.push(count);
    }
    return years.join(",");
  });

  eleventyConfig.addLiquidFilter("getMonthlyPostCount", (posts, year) => {
    let months = [];
    for(let month = 0; month < 12; month++) {
      let count = posts.filter(function(post) {
        let d = post.data.page.date;
        return d.getFullYear() === parseInt(year, 10) && d.getMonth() === month;
      }).length;

      months.push(count);
    }
    return months.join(",");
  });

  eleventyConfig.addLiquidFilter("hostnameFromUrl", (url) => {
    let urlObject = new URL(url);
    return urlObject.hostname;
  });

  eleventyConfig.addLiquidFilter("emoji", function(content) {
    return `<span aria-hidden="true" class="emoji">${content}</span>`;
  });

  // Get the first `n` elements of a collection.
  eleventyConfig.addFilter("head", (array, n) => {
    if( n < 0 ) {
      return array.slice(n);
    }
    return array.slice(0, n);
  });

  eleventyConfig.addFilter("localUrl", (absoluteUrl) => {
    return absoluteUrl.replace("https://www.nothingrandom.studio", "");
  });

  eleventyConfig.addFilter("nameToFlag", (countryName = "") => {
    let flag = {
      "germany": "🇩🇪",
      "us": "🇺🇸",
      "usa": "🇺🇸",
      "netherlands": "🇳🇱",
      "canada": "🇨🇦",
      "spain": "🇪🇸",
      "belarus": "🇧🇾",
      "united kingdom": "🇬🇧",
      "nigeria": "🇳🇬",
      "romania": "🇷🇴",
    }[countryName.toLowerCase()] || "";

    return `<span role="img" aria-label="${countryName}">${flag}</span>`;
  });

  eleventyConfig.addJavaScriptFunction("fetchYoutubeTranscript", async (videoId) => {
    let asset = new AssetCache(`youtube_transcript_${videoId}`);
    if(asset.isCacheValid("*")) {
      return asset.getCachedValue();
    }

    // Remote call
    let transcript = await YoutubeTranscript.fetchTranscript(videoId);
    await asset.save(transcript, "json");
    return transcript;
  });
  /* END FILTERS */

  /* SHORTCODES */
  eleventyConfig.addLiquidShortcode("originalPostEmbed", function(url, skipIcon = false, mode = "screenshot") {
    let imageHtml = "";
    if(mode === "screenshot") {
      imageHtml = screenshotImageHtmlFullUrl(url);
    } else if(mode === "opengraph") {
      imageHtml = opengraphImageHtml(url);
    }

    return `${JS_ENABLED ? `<script type="module" src="/static/browser-window.js"></script>` : ""}
<div><browser-window mode="dark"${skipIcon ? "" : " icon"} url="${url}" shadow flush><a href="${url}" class="favicon-optout">${imageHtml}</a></browser-window></div>`;
  });

  /* COLLECTIONS */
  function getProfiles(collectionApi) {
    return collectionApi.getFilteredByGlob("./_profiles/*").filter(function(item) {
      return !!item.data.permalink;
    });
  }

  eleventyConfig.addCollection("profiles", function(collection) {
    return getProfiles(collection);
  });

  /* Markdown */
  let options = {
    html: true,
    breaks: true,
    linkify: true
  };

  let md = markdownIt(options);
  // let md = markdownIt(options).use(markdownItAnchor, {
  //   permalink: markdownItAnchor.permalink.ariaHidden({
  //     placement: "after",
  //     class: "direct-link",
  //     symbol: "#",
  //     level: [1,2,3,4],
  //   }),
  //   slugify: eleventyConfig.getFilter("slug")
  // }).use(markdownItToc, {
  //   includeLevel: [2, 3, 4],
  //   slugify: eleventyConfig.getFilter("slug"),
  //   format: function(heading) {
  //     return heading;
  //   },
  //   transformLink: function(link) {
  //     if(typeof link === "string") {
  //       // remove backticks from markdown code
  //       return link.replace(/\%60/g, "");
  //     }
  //     return link;
  //   }
  // });

  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPairedShortcode("markdown", function(content, inline = false) {
    if(inline) {
      return md.renderInline(content);
    }
    return md.render(content);
  });

  eleventyConfig.addLiquidFilter("includes", function(arr = [], value) {
    return arr.includes(value);
  });

  eleventyConfig.addLiquidFilter("removeNewlines", function(str) {
    return str.replace(/\n/g, "");
  });
};

module.exports.config = {
  templateFormats: [
    "liquid",
    "md",
    "njk",
    "html",
    "11ty.js",
  ],
  htmlTemplateEngine: "liquid",
  markdownTemplateEngine: "liquid"
};
