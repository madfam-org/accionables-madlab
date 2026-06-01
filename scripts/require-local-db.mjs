const value = String(process.env.LOCAL_DB ?? '').trim().toLowerCase();

if (!['1', 'true', 'yes'].includes(value)) {
    console.error(
        'Refusing to run local database mutation/inspection without LOCAL_DB=yes. Confirm the target database is local or otherwise explicitly approved.'
    );
    process.exit(1);
}
