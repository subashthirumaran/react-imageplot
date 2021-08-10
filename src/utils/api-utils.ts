import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:8080/',
  timeout: 1000,
});

export const loadFile = async (path: string, options = {}) => {
  const response = await instance.get(path, options);
  // console.log('fetching ' + path + ': ', response);
  return response.data;
};
