export class BaseEmail {
	#recipient;
	#subject
	#html;
	/**
	 * @param { string } recipient
	 * @param { string } subject
	 * @param { { html: string, text: string } } html
	 */
	constructor(recipient, subject, html) {
		this.#recipient = recipient;
		this.#subject = subject;
		this.#html = html;
	}

	/**
	 * 
	 * @returns {{ to: string, subject: string, html:string }}
	 */
	getEmail () {
		return {
			to: this.#recipient,
			subject: this.#subject,
			html: this.#html.html,
			text: this.#html.text,
		}
	}
}
