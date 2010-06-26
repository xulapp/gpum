(function () {
     const Cc = Components.classes;
     const Ci = Components.interfaces;

     const DEFAULT_RETRY_COUNT = 3;

     const modules = {};

     let util, http, gmail, Gmail;

     function $(id) document.getElementById(id);

     function loadScript(path, context) {
         Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader).loadSubScript(path, context);
     }

     function loadModule(name, context) {
         let path = "resource://gmml-modules/" + name;

         try {
             if (name.lastIndexOf(".jsm") !== -1)
                 Components.utils.import(path, context);
             else
                 loadScript(path, context);
         } catch (x) {}
     }

     // ============================================================ //

     function setAttributes(aElem, aAttributes) {
         if (aAttributes)
             for (let [key, value] in Iterator(aAttributes))
                 if (key && value)
                     aElem.setAttribute(key, value);
     }

     function genElem(aName, aAttributes) {
         let elem = document.createElement(aName);
         setAttributes(elem, aAttributes);
         return elem;
     }

     function createDescription(msg, attr) {
         let description = genElem("label", attr);
         let textNode    = document.createTextNode(msg);

         description.appendChild(textNode);

         return description;
     }

     function createIcon(cls, tooltiptext) {
         return genElem("spacer", { class       : "gmml-popup-icon" + " " + cls,
                                    tooltiptext : tooltiptext || ""
                                  });
     }

     // ============================================================ //
     // Initialization
     // ============================================================ //

     loadModule("util.jsm", modules);
     util = modules.util;

     loadModule("http.jsm", modules);
     http = modules.http;

     loadModule("gmail.jsm", modules);
     Gmail = modules.Gmail;

     // ============================================================ //

     window.addEventListener(
         "load", function () {
             window.removeEventListener("load", arguments.callee, false);

             let popup = $("gmml-popup");
             let icon  = $("gmml-statusbar-icon");
             let count = $("gmml-statusbar-count");

             if ((gmail = util.storage.gmail))
             {
                 handleUpdate();
             }
             else
             {
                 gmail = util.storage.gmail = new Gmail();

                 gmail.setupScheduler();
                 gmail.startScheduler(true);
             }

             gmail.registerWindow(window);
             document.addEventListener(gmail.UPDATE_EVENT, handleUpdate, false);

             let unreadContainer = genElem("vbox", { flex : 1 });
             popup.appendChild(unreadContainer);

             // ============================================================ //

             let title = genElem("hbox", { id : "gmml-popup-title" });

             // let inboxIcon = createIcon("gmml-popup-icon-inbox");
             // title.appendChild(inboxIcon);

             let composeMailIcon = createIcon("gmml-popup-icon-compose", util.getLocaleString("composeMail"));
             title.appendChild(composeMailIcon);

             composeMailIcon.addEventListener("click", function (ev) {
                                             if (ev.button !== 0)
                                                 return;
                                             openLink(gmail.composeURL);
                                         }, false);

             let inboxLabel = createDescription("", { class : "gmml-link" });
             title.appendChild(inboxLabel);

             inboxLabel.addEventListener("click", function (ev) {
                                             if (ev.button !== 0)
                                                 return;
                                             openLink(gmail.xml.link.@href.toString());
                                         }, false);

             unreadContainer.appendChild(title);

             // ============================================================ //

             let scrollBox = genElem("vbox", { flex : 1 });
             unreadContainer.appendChild(scrollBox);

             function openLink(url) {
                 util.visitLink(url);
                 popup.hidePopup();
             }

             function handleUpdate() {
                 let unreadCount = gmail.unreadCount;

                 count.setAttribute("value", unreadCount);
                 setIconStatus();
             }

             function setIconStatus() {
                 if (gmail.unreadCount > 0)
                     icon.setAttribute("src", "chrome://gmml/skin/icon16/gmail.png");
                 else
                     icon.setAttribute("src", "chrome://gmml/skin/icon16/gmail-blue.png");
             }

             function appendEntry(scrollBox, unread) {
                 let entry = unread.entry;

                 let entryContainer = genElem("vbox");

                 // ============================================================ //

                 let header = genElem("hbox", { class : "gmml-popup-header", align : "center" });

                 let author = createDescription("• " + entry.author.name, {
                                                    class       : "gmml-popup-author gmml-link",
                                                    tooltiptext : entry.author.email
                                                });
                 header.appendChild(author);

                 header.appendChild(genElem("spacer", { flex : 1 }));

                 let modifiedLabel  = createDescription(unread.time.toLocaleDateString(), {
                                                            tooltiptext : unread.time.toString()
                                                        });
                 header.appendChild(modifiedLabel);

                 let actionIconContainer = genElem("hbox", { class : "gmml-popup-action-icon-container", align : "center" });

                 let markAsReadLink = createIcon("gmml-popup-icon-markread", util.getLocaleString("markAsReadLink"));
                 let deleteLink     = createIcon("gmml-popup-icon-delete", util.getLocaleString("deleteLink"));
                 let markAsSpamLink = createIcon("gmml-popup-icon-markspam", util.getLocaleString("markAsSpamLink"));
                 let archiveLink    = createIcon("gmml-popup-icon-archive", util.getLocaleString("archiveLink"));

                 actionIconContainer.appendChild(markAsReadLink);
                 actionIconContainer.appendChild(deleteLink);
                 actionIconContainer.appendChild(markAsSpamLink);
                 actionIconContainer.appendChild(archiveLink);

                 header.appendChild(actionIconContainer);

                 entryContainer.appendChild(header);

                 // ============================================================ //

                 let titleContainer = genElem("hbox", { class : "gmml-popup-title-container", align : "center" });

                 let star = createIcon("gmml-popup-star", util.getLocaleString("addStar"));
                 titleContainer.appendChild(star);

                 let title = createDescription(entry.title, { class : "gmml-popup-title gmml-link" });
                 titleContainer.appendChild(title);

                 titleContainer.appendChild(genElem("spacer", { flex : 1 }));

                 entryContainer.appendChild(titleContainer);

                 // ============================================================ //

                 let bodyContainer = genElem("hbox", { align : "center" });

                 let summary = createDescription(entry.summary, { class : "gmml-popup-summary" });

                 bodyContainer.appendChild(summary);

                 entryContainer.appendChild(bodyContainer);

                 // ============================================================ //

                 scrollBox.appendChild(entryContainer);

                 let id = entry.link.@href.toString().replace(/.*message_id=([\d\w]+).*/, "$1");

                 function handleClick(ev) {
                     if (ev.button !== 0)
                     {
                         window.openDialog("chrome://gmml/content/account-manager.xul",
                                           "AccountManager",
                                           "chrome,titlebar,toolbar,centerscreen,resizable,scrollbars",
                                           "GmmlAccountManager");

                         return;
                     }

                     let target = ev.target;

                     util.killEvent(ev);

                     switch (target)
                     {
                     case author:
                         openLink(gmail.getURLRecentFor(entry.author.email));
                         break;
                     case markAsReadLink:
                         gmail.markAsReadThread(id);
                         destruct();
                         break;
                     case deleteLink:
                         gmail.deleteThread(id);
                         destruct();
                         break;
                     case markAsSpamLink:
                         gmail.spamThread(id);
                         destruct();
                         break;
                     case archiveLink:
                         gmail.archiveThread(id);
                         destruct();
                         break;
                     case star:
                         gmail.starThread(id);
                         break;
                     case title:
                         openLink(entry.link.@href.toString());
                         destruct();
                         break;
                     case summary:
                         break;
                     }
                 }

                 function destruct() {
                     gmail.removeFromUnreads(unread);
                     removeNode();
                 }

                 function removeNode() {
                     entryContainer.removeEventListener("click", handleClick, false);
                     scrollBox.removeChild(entryContainer);
                 }

                 entryContainer.__gmmlDestroy__ = removeNode;

                 entryContainer.addEventListener("click", handleClick, false);
             }

             function clearEntries() {
                 Array.map(scrollBox.childNodes, function (e) e.__gmmlDestroy__).forEach(function (f) f && f());
             }

             window.gmml = {
                 handleStatusBarIconClick:
                 function handleStatusBarIconClick(ev) {
                     if (ev.button !== 0)
                         return;

                     util.killEvent(ev);

                     clearEntries();

                     for each (let unread in gmail.unreads)
                         appendEntry(scrollBox, unread);

                     inboxLabel.textContent = gmail.xml.title.text().toString().replace(/^Gmail - /, "");

                     popup.openPopup(icon, "start_after", 0, 0, false, false);
                 },

                 modules: modules
             };
         }, false);
 })();
