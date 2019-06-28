## Running unit tests

```
apt-get install libpq-dev python3-dev libffi-dev libyaml-dev
pip install tox
tox --recreate -e py3
```

## Docker

The official docker image for this service is `wazopbx/wazo-agentd`.

### Getting the image

To download the latest image from the docker hub

```sh
docker pull wazopbx/wazo-agentd
```

### Running wazo-agentd

```sh
docker run wazopbx/wazo-agentd
```

### Building the image

Building the docker image:

```sh
docker build -t wazopbx/wazo-agentd .
```
