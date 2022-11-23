/* eslint-disable max-len */
const ENUMS = require("../enums");
const DbMixin = require("../mixins/db.mixin");

const AfricasTalking = require("africastalking")({
	apiKey: process.env.AT_KEY,
	username: "sandbox",
});

const USSDMessages = {

	async WELCOME(user, ctx) {
		user.ussdState = ENUMS.ussdStates.WELCOME;
		user.ussdSession = ctx.params.sessionId;
		await ctx.call("users.update", { id: user._id, ...user });
		return `CON Welcome to AgriMint!
    AgriMint is your own community bank where you can
    securely save money, pay, borrow and 
    protect against surprising events,
    together with other members!

    1. Activate AgriMint account
		2. Login into your account
    9. Exit`;
	},

	async REGISTER(user, ctx) {
		user.ussdState = ENUMS.ussdStates.REGISTER;
		await ctx.call("users.update", { id: user._id, ...user });
		// TODO Validate OTP before setting PIN
		return `CON Please enter your secret PIN code
    to let us know that it’s you.  
    Don’t share your PIN code with anyone,
    including other AgriMint members and guardians!`;
	},

	async REGISTER_CON(user, ctx) {
		const [command, secret, confirmSecret] = ctx.params.text.split("*");
		if ((command === "1") && secret && !confirmSecret) {
			return "CON Please confirm your PIN code";
		} else if ((command === "1") && (secret === confirmSecret)) {
			await ctx.call("users.activate", { user, secret });
			user.state = ENUMS.userStates.REGISTERED;
			user.ussdState = ENUMS.ussdStates.MAIN_MENU;
			await ctx.call("users.update", { id: user._id, ...user });
			return `CON PIN Set. Continue to main menu:
      1. Continue
      99. Exit`;
		} else if ((command === 1) && (secret !== confirmSecret)) {
			return await this.SESSION_END(user, ctx, "PIN does not match.");
		}
	},

	async JOIN_FEDERATION(user, ctx) {
		user.ussdState = ENUMS.ussdStates.JOIN_FEDERATION_CON
		await ctx.call("users.update", { id: user._id, ...user });
		return `CON Enter Invitation Code:`
	},

	async JOIN_FEDERATION_CON(user, ctx) {
		const text = ctx.	params.text.split("*")
		const invitationCode = text[text.length - 1]
		await ctx.call("users.joinFederation", { user, invitationCode })
		user.ussdState = ENUMS.ussdStates.MAIN_MENU
		await ctx.call("users.update", { id: user._id, ...user });
		return `CON Joined Federation.
		1. To Continue
		9. To Exit`
	},

	async MAIN_MENU(user, ctx) {
		user.ussdState = ENUMS.ussdStates.MAIN_MENU_SEL
		await ctx.call("users.update", { id: user._id, ...user });
		return `CON Welcome to AgriMint!
			What would you like to do:	
	
			1. Join Federation
			2. Get Federations
			3. Get balance
			4. Send Money
			5. Receive money
			9. Exit
			`
	},

	async GET_FEDERATIONS(user, ctx) {
		const federations = await ctx.call("users.getFederations", { user })
		user.ussdState = ENUMS.ussdStates.MAIN_MENU
		await ctx.call("users.update", { id: user._id, ...user });
		let msg = `CON Federations
		`
		federations.forEach(f => msg += `${f}
		`)
		msg += `Press: 
		1. To Main Menu
		9. To Exit
		`
		return msg
	},

	async GET_BALANCE(user, ctx) {
		const federations = await ctx.call("users.getFederations", { user })
		user.ussdState = ENUMS.ussdStates.GET_BALANCE_FED
		await ctx.call("users.update", { id: user._id, ...user });
		let msg = `CON dial federation Id:
		`
		federations.forEach(f => msg += `${f}
		`)
		return msg
	},

	async GET_BALANCE_FED(user, ctx) {
		const text = ctx.params.text.split("*")
		const federationId = text[text.length - 1]
		user.ussdState = ENUMS.ussdStates.MAIN_MENU
		await ctx.call("users.update", { id: user._id, ...user });
		const balance = (await ctx.call("users.getBalance", { user, federationId })).total_amount
		return `CON your balance is:
		${balance}
		Select:
		1. To Main Menu
		9. To Exit
		`
	},

	async MAIN_MENU_SEL(user, ctx) {
		const commands = (ctx.params.text.split("*"))
		const command = commands[commands.length - 1]

		switch (command) {
			case '1': return USSDMessages.JOIN_FEDERATION(user, ctx)
			case '2': return USSDMessages.GET_FEDERATIONS(user, ctx)
			case '3': return USSDMessages.GET_BALANCE(user, ctx)
			case '4':
			case '5':
			case '9': return USSDMessages.SESSION_END(user, ctx, 'Bye')
		}

	},

		async LOGIN_PROMPT() {
		return Promise.resolve("CON Enter PIN to login:");
	},

	async SESSION_END(user, ctx, message) {
		const { serviceCode } = ctx.params;
		user.ussdSession = "";
		user.ussdState = ENUMS.ussdStates.NULL;
		await ctx.call("users.update", { id: user._id, ...user });
		return `END ${message}
    Session ended.
    Dial again ${serviceCode} to start new session.`;
	}
};

module.exports = {
	name: "ussd",
	mixins: [],
	settings: {},
	actions: {

		menu: {
			params: {
				phoneNumber: "string",
				sessionId: "string",
				serviceCode: "string",
				text: "string"
			},
			async handler(ctx) {
				const {
					phoneNumber: phone,
					sessionId,
					text } = Object.assign({}, ctx.params);
				ctx.meta.$responseType = "text/plain";
				const phoneRaw = phone.split('+')[1]
				const countryCode = phoneRaw.slice(0, 3)
				const phoneNumber = phoneRaw.slice(3)
				let user = (await ctx.call("users.find", {
					query: {
						countryCode, phoneNumber
					}
				}))[0];
				if (!user) {
					user = await ctx.call('users.create', {
						phoneNumber,
						countryCode,
						state: ENUMS.userStates.SIGNUP,
						federations: []
					})
				}
				if (text.split("*").slice(-1) === "9") {
					return await USSDMessages.SESSION_END(user, ctx);
				}
				if (text === "" || !this.validateSession(user.ussdSession, sessionId)) {
					return await USSDMessages.WELCOME(user, ctx);
				} else {
					return await this.stateMachine(user, ctx);
				}
			}
		},


		sendSMS: {
			params: {
				countryCode: "string",
				phoneNumber: "string",
				message: "string"
			},
			async handler(ctx) {
				ctx.meta.$contentType = "application/x-www-form-urlencoded";
				ctx.meta.$authToken = process.env.AT_KEY;
				const { countryCode, phoneNumber, message } = Object.assign({}, ctx.params);
				const to = `+${countryCode}${phoneNumber}`;
				const sms = AfricasTalking.SMS;
				const response = await sms.send({ to, message, enque: true });
				return response;
			}
		}
	},

	methods: {
		setUssdState(user) {
			switch (user.ussdState) {
				case ENUMS.ussdStates.WELCOME: {
					if (user.state === ENUMS.userStates.SIGNUP) {
						return ENUMS.ussdStates.REGISTER;
					} else {
						return ENUMS.ussdStates.MAIN_MENU;
					}
				}
				default: {
					return ENUMS.ussdStates.NULL;
				}
			}
		},

		validateSession(session, sessionId) {
			return (session === sessionId);
		},

		async stateMachine(user, ctx) {
			const { text } = Object.assign({}, ctx.params);
			const [command, ...rest] = text.split("*");
			switch (user.ussdState) {
				case ENUMS.ussdStates.WELCOME: {
					if (command === "1") {
						return await USSDMessages.REGISTER(user, ctx);
					}
					if (command === "2") {
						const secret = rest[rest.length - 1];
						if (!secret) {
							return await USSDMessages.LOGIN_PROMPT();
						} else {
							await ctx.call("users.login", { user, secret })
							user.ussdState = this.setUssdState(user);
							const userUpdated = await ctx.call("users.update", { id: user._id, ...user });
							return await this.stateMachine(userUpdated, ctx);
						}
					} if (text === "9") {
						return await USSDMessages.SESSION_END(user, ctx, "Good Bye!");
					}
				}
					break;
				case ENUMS.ussdStates.REGISTER: {
					return await USSDMessages.REGISTER_CON(user, ctx);
				}
				case ENUMS.ussdStates.MAIN_MENU: {
					return await USSDMessages.MAIN_MENU(user, ctx);
				}
				case ENUMS.ussdStates.MAIN_MENU_SEL: {
					return await USSDMessages.MAIN_MENU_SEL(user, ctx);
				}
				case ENUMS.ussdStates.GET_BALANCE_FED: {
					return await USSDMessages.GET_BALANCE_FED(user, ctx);
				}
				case ENUMS.ussdStates.JOIN_FEDERATION_CON: {
					return await USSDMessages.JOIN_FEDERATION_CON(user, ctx);
				}
				JOIN_FEDERATION

				default: {
					return await USSDMessages.SESSION_END(user, ctx, `${user.ussdState} state not implemented yet`);
				}
			}
		},
	}
	// async started() {
	// }



	/**
		* Settings
		*/
};
