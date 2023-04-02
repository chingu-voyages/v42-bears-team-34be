import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();
const agent = axios.create({
	baseURL: process.env.WEBHOOK_BASE_URL + "/hooks",
	headers: {
		"Authorization": `bearer ${process.env.WEB_HOOK_API_TOKEN}`
	}
});

export class WebHook {
	/**
	 * 
	 * @param {string} url 
	 * @param {object} data 
	 * @returns 
	 */
	async sendEmail (url, data) {
		return agent.post(`/email${url}`, data)
	}
}
