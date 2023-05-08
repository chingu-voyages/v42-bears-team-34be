/* eslint-disable import/prefer-default-export */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const agent = axios.create({
  baseURL: `${process.env.EMAIL_MICROSERVICE_BASE_URL}hooks`,
  headers: {
    Authorization: `bearer ${process.env.EMAIL_MICROSERVICE_API_TOKEN}`,
  },
});

class EmailServiceClient {
  /**
   *
   * @param {string} url
   * @param {object} data
   * @returns
   */
  // eslint-disable-next-line class-methods-use-this
  async sendEmail(url, data) {
    return agent.post(`/email${url}`, data);
  }
}

const emailServiceClient = new EmailServiceClient();
export { emailServiceClient };
