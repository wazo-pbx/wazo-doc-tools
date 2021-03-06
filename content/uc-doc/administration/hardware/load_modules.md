---
title: Load the correct DAHDI modules
---

**Note**: For your Digium card to work properly you must load the appropriate DAHDI kernel module.
This is done via the file `/etc/dahdi/modules` and this page will guide you through its
configuration.

## Know which card is in your server

You can see which cards are detected by issuing the `dahdi_hardware` command:

```shell
# dahdi_hardware
pci:0000:05:0d.0     wcb4xxp-     d161:b410 Digium Wildcard B410P
pci:0000:05:0e.0     wct4xxp-     d161:0205 Wildcard TE205P (4th Gen)
```

This command gives the card name detected and, more importantly, the DAHDI kernel module needed for
this card. In the above example you can see that two cards are detected in the system:

- a Digium B410P _which needs_ the `wcb4xxp` module
- and a Digium TE205P _which needs_ the `wct4xxp` module

## Create the configuration file

Now that we know the modules we need, we can create our configuration file:

1.  Create the file `/etc/dahdi/modules`:

    ```shell
    touch /etc/dahdi/modules
    ```

2.  Fill it with the modules name you found with the `dahdi_hardware` command (one module name per
    line). In our example, your `/etc/dahdi/modules` file should contain the following lines:

    ```ini
    wcb4xxp
    wct4xxp
    ```

**Note**: In the `/usr/share/dahdi/modules.sample` file you can find all the modules supported in
your Wazo version.

## Apply the configuration

To apply the configuration, restart the services:

```shell
wazo-service restart
```

## Next step

Now that you have loaded the correct module for your card you must:

1. check if you need to follow one of the
   [Specific configuration](/uc-doc/administration/hardware/load_modules#dahdi-modules-specific-conf)
   sections below,
2. and continue with the next configuration step which is to
   [configure the echo canceller](/uc-doc/administration/hardware/echo_canceller).

## Specific configuration {#dahdi-modules-specific-conf}

This section lists some specific configuration. You should not follow them unless you have a
specific need.

### TE13x, TE23x, TE43x: E1/T1 selection {#dahdi-linemode-selection}

With E1/T1 cards you must select the correct _line mode_ between:

- E1 : the European standard,
- and T1 : North American standard

For old generation cards (TE12x, TE20x, TE40x series) the _line mode_ is selected via a physical
jumper.

For new generation cards like TE13x, TE23x, TE43x series the _line mode_ is selected by
configuration.

If you're configuring one of these **TE13x, T23x, T43x** cards then you **MUST** create a
configuration file to set the line mode to E1:

1. Create the file `/etc/modprobe.d/xivo-wcte-linemode.conf`:

   ```shell
   touch /etc/modprobe.d/xivo-wcte-linemode.conf
   ```

2. Fill it with the following lines replacing `DAHDI_MODULE_NAME` by the correct module name
   (`wcte13xp`, `wcte43x` ...):

   ```
   # set the card in E1/T1 mode
   options DAHDI_MODULE_NAME default_linemode=e1
   ```

3. Then, restart the services:

   ```shell
   wazo-service restart
   ```
