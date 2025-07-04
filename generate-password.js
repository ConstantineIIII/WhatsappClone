const bcrypt = require('bcryptjs');

const password = 'KalelKalel1!';
const saltRounds = 12;

console.log('Generating hash for password:', password);
bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error('Error generating hash:', err);
        process.exit(1);
    }
    console.log('Password:', password);
    console.log('Hash:', hash);
    process.exit(0);
}); 