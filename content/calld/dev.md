## Running unit tests

```
pip install tox
tox --recreate -e py35
```

## Running integration tests

You need Docker installed on your machine.

1. ```cd integration_tests```
2. ```pip install -r test-requirements.txt```
3. ```git clone https://github.com/wazo-pbx/chan-test```
4. ```export CHAN_TEST_DIR=$PWD/chan-test   # CHAN_TEST_DIR defaults to ../../chan-test```
4. ```make test-setup```
5. ```make test```

### Environment variables

Running the integration tests is controlled by the following environment variables:

* `INTEGRATION_TEST_TIMEOUT`: controls the startup timeout of each container
* `LOCAL_GIT_REPOS`: may be used to mount development python packages inside containers
