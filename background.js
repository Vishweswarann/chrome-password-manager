
let hashedPassword = null;


// This functin saves the data in the storage. The function inside this is called by sendMessage in save.js file
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	console.log("2. Message received in Background.");


	// Encrypting the password

	encryptPassword(msg["password"]).then((encryptedPassword) => {



		msg["password"] = encryptedPassword;


		// Save the data
		chrome.storage.local.set({ [msg["domain"]]: msg }).then(() => {
			console.log("Saved in storage");
			// Send success ONLY after saving is done
			sendResponse({ status: "Success" });
		});


	});

	return true;
});


async function encryptPassword(pswd) {

	const key = hashedPassword;
	const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

	const encoder = new TextEncoder();
	const data = encoder.encode(pswd);


	const encryptedContent = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: iv
		},
		key,
		data
	);

	const storableEncryptedContent = Array.from(new Uint8Array(encryptedContent));

	return storableEncryptedContent;

}

// This creates an option in the menu 'Auto-Fill Password' when we right click on an input element
chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: "fill-password",
		title: "Auto-Fill Password",
		contexts: ["editable"]
	});

	getHashedPassword();


});


async function getHashedPassword() {

	const passwordString = "Vanakam";
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(passwordString);
	const saltBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
	const keyCheckString = "Visu"; // This string is encrypted and stored in the database, to check if the user has entered the correct password we create the key for the user entered string and convert this value and check if it is same. 

	// This is NOT the final key. It's just the 'raw material' for the blender.
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		passwordBuffer,
		{ name: "PBKDF2" },
		false,
		["deriveKey"]
	);

	const finalKey = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: saltBuffer,
			iterations: 100000,
			hash: "SHA-256"
		},
		keyMaterial, // The output from Step 1
		{ "name": "AES-GCM", "length": 256 }, // What kind of key do we want out?
		true, // Can we export this key later?
		["encrypt", "decrypt"] // What is this key allowed to do?
	);

	hashedPassword = finalKey;

	return finalKey;



}

// This creates an callback function when the 'Auto-Fill Password' option is pressed
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "fill-password") {



		const url = new URL(tab.url);
		const domain = url.hostname;


		chrome.storage.local.get([domain]).then((result) => {

			if (result[domain]) {

				const data = result[domain];
				decryptPassword(data["password"]).then((decryptedPassword) => {
					data["password"] = decryptedPassword;
					// Only send if the page is fully loaded ('complete')
					chrome.tabs.sendMessage(tab.id, {
						action: "context-fill",
						data: data
					}).catch(error => {
						// Catch the error so it doesn't clutter the console
						console.log("Tab wasn't ready or content script missing.");
					});



				});

			}
			else {
				console.log("No password saved for this site");
			}
		});


	}
});




async function decryptPassword(encrptedUint8Pswd) {


	const ciphertext = new Uint8Array(encrptedUint8Pswd);
	const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

	const decryptedBuffer = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv: iv
		},
		hashedPassword, // The same key derived from the master password
		ciphertext
	);

	const decoder = new TextDecoder();
	const plainTextPassword = decoder.decode(decryptedBuffer);

	return plainTextPassword;

}
