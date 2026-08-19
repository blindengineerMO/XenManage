# Project Summary

This project will create a modern well designed web interface fo administering and maintaing xenserver pools, hosts, virtual machines, storage, networking, etc.  The XenCenter interface provided is ugly and outdated. We want a futuristic, post modern, design. The folder layout is already done, please place/seperate components, routes, etc into their resspective folders. Create new folders as needed to maintain organization and code readability. Include complete E2E, and unit/jest testing.

## Design Information
Post Modern Futuristic Dark Liquid Glassmorphic Styling with a Matrix meets Hackers type of interface design. Include custom box shadows/borders/corners, floating left navigation and floating top menu/nav with custom edges and design styling.  There should be an activator on the topnav to hide/unhide left nav. Avoid default alert views and modals for custom styled floating/movable dialogs/windows instead.  The UI/UX should be dense without a lot of wasted space while maintaing a very professional feeling to it.  We should use vue.js with the flux design system.  We should use google fonts to find appropriate yet not commonly used fonts. Avoid excessive or un-necessary text in the UI. Any properties/configuration dialogs should be in floating windows/dialogs.  Use Z-Index to provide window/dialog layering, presentation, and effects. Use Material Design Icons for Icons, and flux for controls. Left Navigation should be a stylized expandable/collapsable tree view of the required resources similar to XenCenter but better layout/design. Any tables used should have search/sort/filter/pagination. Dashboard should have a full grid/drag and drop/movable style interface/elements.  The inital dashboard should have a summary of all the resources in your environment.  We will start as a single user application but will eventually move to multi-user model.  Custom 404/500/error pages. Custom Logos/favicons AI generated. The design should be a responsive/flex model handling screen resizing automatically. 

## Preferred Packages
You can add/modify these as best needed to meet the project goals. Ensure any packages we use have no critical CVE's. 

Node.Js
Express for Web Server/API/Server Routing
path for path normalization
helmet for HTTP security
SQLLite for database with SQL injection protection
Vue.Js for frontend - Served via Express with api proxied on the same port (3000)
Flux for design system
Material Design Icons for Icons
Google Fonts for Typography
Tailwind CSS for Styling
Charts.JS for graphs/radials
Vuetify if needed for design system in addition to flux

## Research
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api.html
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/wire-protocol
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/vm-lifecycle
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/classes
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/relationships-between-classes
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/types
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-auth
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-blob
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-bond
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-certificate
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-cluster
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-cluster_host
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-console
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-data_source
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-dr_task
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-driver_variant
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-event
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-feature
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-gpu_group
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-host
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-host_cpu
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-host_crashdump
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-host_driver
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-host_metrics
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-host_patch
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-lvhd
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-message
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-network
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-network_sriov
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-observer
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pbd
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pci
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pgpu
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pif
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pif_metrics
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pool
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pool_patch
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pool_update
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-probe_result
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pusb
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pvs_cache_storage
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pvs_proxy
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pvs_server
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-pvs_site
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-repository
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-role
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-sdn_controller
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-secret
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-session
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-sm
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-sr
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-sr_stat
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-subject
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-task
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-tunnel
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-usb_group
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-user
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vbd
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vbd_metrics
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vdi
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vdi_nbd_server_info
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vgpu
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vgpu_type
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vif
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vif_metrics
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vlan
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vm
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vm_appliance
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vm_group
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vm_guest_metrics
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vm_metrics
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vmpp
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vmss
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vtpm
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/class-vusb
https://docs.xenserver.com/en-us/xenserver/developer/xenserver-9/management-api/api-errors
https://docs.xenserver.com/en-us/xenserver/9/xenserver-9.pdf
https://docs.xenserver.com/en-us/xenserver/9/
https://docs.xenserver.com/en-us/xenserver/9/
https://docs.xenserver.com/en-us/xencenter/current-release
https://docs.xenserver.com/en-us/xencenter/current-release/hosts-connect
https://docs.xenserver.com/en-us/xencenter/current-release/vms

### Additional Information
1. First Research, then DEEPTHINK a plan and build a detailed plan.md for tracking and memory to avoid loss of position post compact. Ensure testing and after each pass ressearch if there are ways to improve or better it and add those to the plan.
2. Once a plan is built work through each item in detail before continuing, avoid user interruption and asky any questions during the research phase you will need to know for design/implementation.
3. Maintain a proper/detailed README with application usage, summary, installation, configuration, architecture, routing information, usage examples.
4. This is an API first application , the view layer is strictly view - use server side rendering as much as possible.
5. UI/UX Styling and design is of uptmost importance , avoid commonly used designs and elements and go outside of the box on this one.
6. API verification and type checking on submissions
7. Maintain Security as top priority for this application
8. You have the freedom to add/remove packages/modules, execute commands on this machine, crawl the internet for research, etc. 